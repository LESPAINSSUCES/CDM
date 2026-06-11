import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WC2026_GAMES_URL = Deno.env.get('WC2026_GAMES_URL') || 'https://worldcup26.ir/get/games';

type WcGame = {
  id?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;
  away_team_label?: string;
  home_score?: string;
  away_score?: string;
  local_date?: string;
  finished?: string;
  time_elapsed?: string;
  group?: string;
  type?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(WC2026_GAMES_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`worldcup26 HTTP ${res.status}`);
    const data = await res.json();
    const games: WcGame[] = data?.games || [];
    const fixtures = pickTodayGames(games).map(normalizeGame);

    return json({
      fixtures,
      fetchedAt,
      count: fixtures.length,
      source: 'worldcup26.ir',
    });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : 'Erreur proxy worldcup26',
      fixtures: [],
      fetchedAt,
      source: 'worldcup26.ir',
    }, 502);
  }
});

function pickTodayGames(games: WcGame[]): WcGame[] {
  const todayParis = parisDateKey(new Date());
  const picked = games.filter((g) => {
    const elapsed = String(g.time_elapsed || '').toLowerCase();
    if (elapsed === 'live') return true;
    const key = gameDateKey(g.local_date);
    return key === todayParis;
  });
  return sortGames(picked.length ? picked : games.filter((g) => String(g.time_elapsed || '').toLowerCase() === 'live'));
}

function gameDateKey(localDate?: string): string {
  if (!localDate) return '';
  const m = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function parisDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

function sortGames(games: WcGame[]): WcGame[] {
  return [...games].sort((a, b) => {
    const liveA = String(a.time_elapsed || '').toLowerCase() === 'live' ? 0 : 1;
    const liveB = String(b.time_elapsed || '').toLowerCase() === 'live' ? 0 : 1;
    if (liveA !== liveB) return liveA - liveB;
    return String(a.local_date || '').localeCompare(String(b.local_date || ''));
  });
}

function normalizeGame(g: WcGame) {
  const home = g.home_team_name_en || g.home_team_label || '—';
  const away = g.away_team_name_en || g.away_team_label || '—';
  const hs = parseInt(String(g.home_score ?? ''), 10);
  const as = parseInt(String(g.away_score ?? ''), 10);
  const hasScore = !Number.isNaN(hs) && !Number.isNaN(as);
  const elapsed = String(g.time_elapsed || '').toLowerCase();
  const finished = String(g.finished || '').toUpperCase() === 'TRUE';

  let short = 'NS';
  if (elapsed === 'live') short = 'LIVE';
  else if (finished) short = 'FT';

  const kickoff = parseLocalKickoffParis(g.local_date);

  return {
    teams: { home: { name: home }, away: { name: away } },
    goals: hasScore ? { home: hs, away: as } : { home: null, away: null },
    status: {
      short,
      long: statusLabel(short, kickoff),
      elapsed: elapsed === 'live' ? null : undefined,
    },
    league: { id: 1, name: 'World Cup' },
    group: g.group || '',
    matchId: g.id || '',
    scorers: { home: g.home_scorers, away: g.away_scorers },
    fixture: kickoff ? { date: kickoff.toISOString() } : undefined,
  };
}

function statusLabel(short: string, kickoff: Date | null): string {
  if (short === 'LIVE') return 'En cours';
  if (short === 'FT') return 'Terminé';
  if (kickoff) {
    return kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  }
  return 'À venir';
}

function parseLocalKickoffParis(localDate?: string): Date | null {
  if (!localDate) return null;
  const m = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const month = parseInt(m[1], 10) - 1;
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const utcGuess = Date.UTC(year, month, day, hour + 6, minute, 0);
  return new Date(utcGuess);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
