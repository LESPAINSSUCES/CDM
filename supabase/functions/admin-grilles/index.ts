import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  const pinHashExpected = Deno.env.get('ORGANIZER_PIN_HASH') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

  if (!pinHashExpected || !serviceKey || !supabaseUrl) {
    return json({ error: 'Secrets Supabase manquants (ORGANIZER_PIN_HASH, service role).' }, 500);
  }

  let body: { action?: string; email?: string; pin?: string; pinHash?: string; league?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps JSON invalide.' }, 400);
  }

  const pinHash = body.pinHash || (body.pin ? await sha256(String(body.pin)) : '');
  if (!pinHash || pinHash !== pinHashExpected) {
    return json({ error: 'Accès refusé.' }, 403);
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) {
    return json({ error: 'E-mail obligatoire.' }, 400);
  }
  const league = String(body.league || 'pains-suces').trim().toLowerCase() || 'pains-suces';

  const supabase = createClient(supabaseUrl, serviceKey);

  if (body.action === 'delete') {
    const { error, count } = await supabase
      .from('grilles')
      .delete({ count: 'exact' })
      .eq('email', email)
      .eq('league_id', league);

    if (error) {
      return json({ error: error.message }, 500);
    }
    if (!count) {
      return json({ error: 'Aucune grille trouvée pour cet e-mail dans cette ligue.' }, 404);
    }
    return json({ ok: true, deleted: count, email, league });
  }

  if (body.action === 'reset_code') {
    const { data, error } = await supabase
      .from('grilles')
      .update({ code_hash: null })
      .eq('email', email)
      .eq('league_id', league)
      .select('email');

    if (error) {
      return json({ error: error.message }, 500);
    }
    if (!data?.length) {
      return json({ error: 'Aucune grille trouvée pour cet e-mail dans cette ligue.' }, 404);
    }
    return json({ ok: true, reset: true, email, league });
  }

  return json({ error: 'Action inconnue.' }, 400);
});
