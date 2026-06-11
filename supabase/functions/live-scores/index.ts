import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WC_LEAGUE = 1; // FIFA World Cup on API-Football
const WC_SEASON = 2026;
const LIVE_STATUS = '1H-HT-2H-ET-P-BT-LIVE';

type FixtureRow = { fixture?: { id?: number }; league?: { id?: number } };

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
    const fixtures = await fetchWcFixtures(key);
    return json({ fixtures, fetchedAt, count: fixtures.length });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : 'Erreur API',
      fixtures: [],
      fetchedAt,
    }, 502);
  }
});

async function fetchWcFixtures(key: string): Promise<FixtureRow[]> {
  const seen = new Set<number>();
  const out: FixtureRow[] = [];

  const add = (list: FixtureRow[]) => {
    for (const f of filterWc(list)) {
      const id = f.fixture?.id;
      if (id != null && !seen.has(id)) {
        seen.add(id);
        out.push(f);
      }
    }
  };

  // 1. Live CDM — API-Football : live=1 (pas live=all&league=1)
  const liveRes = await apiFetch(key, `fixtures?live=${WC_LEAGUE}`);
  add(liveRes?.response || []);
  if (out.length) return out;

  // 2. Matchs en cours par statut
  const statusRes = await apiFetch(
    key,
    `fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=${LIVE_STATUS}`,
  );
  add(statusRes?.response || []);
  if (out.length) return out;

  // 3. Calendrier du jour (fuseau France + UTC, inclut lendemain pour coups d'envoi tardifs)
  for (const date of getDateStrings()) {
    const dayRes = await apiFetch(
      key,
      `fixtures?date=${date}&league=${WC_LEAGUE}&season=${WC_SEASON}&timezone=Europe/Paris`,
    );
    add(dayRes?.response || []);
    if (out.length) return out;
  }

  return out;
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

async function apiFetch(key: string, path: string) {
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
