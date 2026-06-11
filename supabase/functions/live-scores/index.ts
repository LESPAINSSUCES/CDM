import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WC_LEAGUE = 1; // FIFA World Cup on API-Football
const WC_SEASON = 2026;
const LIVE_STATUS = '1H-HT-2H-ET-P-BT-LIVE';

type FixtureRow = { fixture?: { id?: number }; league?: { id?: number } };
type ApiPayload = {
  response?: FixtureRow[];
  results?: number;
  errors?: Record<string, string> | string[];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const key = Deno.env.get('APIFOOTBALL_KEY') || '';
  const fetchedAt = new Date().toISOString();

  if (!key) {
    return json({
      error: 'APIFOOTBALL_KEY non configurée sur Supabase (Secrets).',
      fixtures: [],
      fetchedAt,
    });
  }

  try {
    const { fixtures, apiErrors } = await fetchWcFixtures(key);
    const body: Record<string, unknown> = { fixtures, fetchedAt, count: fixtures.length };
    if (!fixtures.length && apiErrors.length) {
      body.apiFootballErrors = apiErrors;
      body.error = summarizeApiErrors(apiErrors);
    }
    return json(body);
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : 'Erreur API',
      fixtures: [],
      fetchedAt,
    }, 502);
  }
});

async function fetchWcFixtures(key: string): Promise<{ fixtures: FixtureRow[]; apiErrors: string[] }> {
  const seen = new Set<number>();
  const out: FixtureRow[] = [];
  const apiErrors: string[] = [];

  const add = (list: FixtureRow[]) => {
    for (const f of filterWc(list)) {
      const id = f.fixture?.id;
      if (id != null && !seen.has(id)) {
        seen.add(id);
        out.push(f);
      }
    }
  };

  const tryFetch = async (path: string) => {
    const data = await apiFetch(key, path);
    collectApiErrors(data, apiErrors);
    add(data?.response || []);
    return out.length > 0;
  };

  if (await tryFetch(`fixtures?live=${WC_LEAGUE}`)) return { fixtures: out, apiErrors };
  if (await tryFetch(`fixtures?live=all`)) return { fixtures: out, apiErrors };
  if (await tryFetch(`fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=${LIVE_STATUS}`)) {
    return { fixtures: out, apiErrors };
  }

  for (const date of getDateStrings()) {
    if (await tryFetch(
      `fixtures?date=${date}&league=${WC_LEAGUE}&season=${WC_SEASON}&timezone=Europe/Paris`,
    )) {
      return { fixtures: out, apiErrors };
    }
  }

  return { fixtures: out, apiErrors };
}

function collectApiErrors(data: ApiPayload | null, out: string[]) {
  const err = data?.errors;
  if (!err) return;
  if (Array.isArray(err)) {
    for (const e of err) if (e && !out.includes(e)) out.push(String(e));
    return;
  }
  for (const val of Object.values(err)) {
    const msg = String(val);
    if (msg && !out.includes(msg)) out.push(msg);
  }
}

function summarizeApiErrors(errors: string[]): string {
  const text = errors.join(' · ');
  if (/suspended/i.test(text)) {
    return 'Compte API-Football suspendu — réactivez-le sur dashboard.api-football.com puis mettez à jour APIFOOTBALL_KEY dans Supabase.';
  }
  if (/free plans do not have access to this season/i.test(text)) {
    return 'Plan API-Football gratuit : pas d’accès à la CDM 2026 (saison 2026). Il faut un abonnement payant incluant cette compétition.';
  }
  return 'API-Football : ' + text;
}

function getDateStrings(): string[] {
  const dates = new Set<string>();
  const now = new Date();

  dates.add(now.toISOString().slice(0, 10));
  const tomorrowUtc = new Date(now);
  tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
  dates.add(tomorrowUtc.toISOString().slice(0, 10));

  for (const offsetDays of [0, 1]) {
    const t = new Date(now.getTime() + offsetDays * 86400000);
    dates.add(t.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }));
  }

  return [...dates];
}

function filterWc(list: FixtureRow[]) {
  return list.filter((f) => f.league?.id === WC_LEAGUE);
}

async function apiFetch(key: string, path: string): Promise<ApiPayload | null> {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
