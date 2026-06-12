/**
 * API worldcup26.ir via proxy Supabase (CORS). Partagé widget + organisateur.
 */
(function (global) {
  const FETCH_TIMEOUT_MS = 18000;
  const DEFAULT_RETRIES = 3;
  const RETRY_BASE_MS = 1200;

  const EN_TO_FR = {
    Mexico: 'Mexique',
    'South Africa': 'Afrique du Sud',
    'South Korea': 'Corée du Sud',
    'Czech Republic': 'Rép. Tchèque',
    Canada: 'Canada',
    'Bosnia and Herzegovina': 'Bosnie Herzégovine',
    Qatar: 'Qatar',
    Switzerland: 'Suisse',
    Brazil: 'Brésil',
    Morocco: 'Maroc',
    Haiti: 'Haïti',
    Scotland: 'Écosse',
    'United States': 'États-Unis',
    Paraguay: 'Paraguay',
    Australia: 'Australie',
    Turkey: 'Turquie',
    Germany: 'Allemagne',
    Curaçao: 'Curacao',
    'Ivory Coast': "Côte d'Ivoire",
    Ecuador: 'Équateur',
    Netherlands: 'Pays-Bas',
    Japan: 'Japon',
    Sweden: 'Suède',
    Tunisia: 'Tunisie',
    Belgium: 'Belgique',
    Egypt: 'Égypte',
    Iran: 'Iran',
    'New Zealand': 'Nouvelle Zélande',
    Spain: 'Espagne',
    'Cape Verde': 'Cap Vert',
    'Saudi Arabia': 'Arabie Saoudite',
    Uruguay: 'Uruguay',
    France: 'France',
    Senegal: 'Sénégal',
    Iraq: 'Irak',
    Norway: 'Norvège',
    Argentina: 'Argentine',
    Algeria: 'Algérie',
    Austria: 'Autriche',
    Jordan: 'Jordanie',
    Portugal: 'Portugal',
    'Democratic Republic of the Congo': 'RD Congo',
    Uzbekistan: 'Ouzbékistan',
    Colombia: 'Colombie',
    England: 'Angleterre',
    Croatia: 'Croatie',
    Ghana: 'Ghana',
    Panama: 'Panama',
  };

  function teamLabel(name) {
    if (!name || /^(Runner-up|Winner|3rd|Loser)\b/i.test(name)) return name;
    return EN_TO_FR[name] || name;
  }

  function normTeam(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getProxyUrl() {
    const cfg = global.CDM_CONFIG || {};
    if (cfg.liveScoresUrl) return cfg.liveScoresUrl;
    if (cfg.supabaseUrl) return cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/live-scores';
    return '';
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function friendlyFetchError(err, httpStatus) {
    if (httpStatus === 502) {
      return 'Proxy Supabase injoignable (worldcup26 en panne). Réessayez dans quelques minutes.';
    }
    if (httpStatus && httpStatus >= 500) {
      return `Erreur serveur Supabase (${httpStatus}). Réessayez plus tard.`;
    }
    if (err?.name === 'AbortError') {
      return 'Délai dépassé — le proxy Supabase (live-scores) ne répond pas. Vérifiez le déploiement Edge Function.';
    }
    const raw = String(err?.message || err || '').trim();
    if (!raw || raw === 'Failed to fetch') {
      return 'Connexion impossible au proxy Supabase. Vérifiez le réseau ou redéployez live-scores (JWT désactivé).';
    }
    return raw;
  }

  function normalizeFixture(f) {
    const home = teamLabel(f.teams?.home?.name);
    const away = teamLabel(f.teams?.away?.name);
    const gh = f.goals?.home;
    const ga = f.goals?.away;
    const hasScore = gh != null && ga != null && !Number.isNaN(Number(gh)) && !Number.isNaN(Number(ga));
    const short = f.status?.short || 'NS';
    return {
      home,
      away,
      scoreHome: hasScore ? Number(gh) : null,
      scoreAway: hasScore ? Number(ga) : null,
      statusShort: short,
      isLive: short === 'LIVE' || short === '1H' || short === '2H' || short === 'HT',
      isFinished: short === 'FT' || short === 'AET' || short === 'PEN',
      group: f.group || '',
      matchId: f.matchId || '',
      raw: f,
    };
  }

  async function fetchLiveFixtures(options = {}) {
    const retries = options.retries ?? DEFAULT_RETRIES;
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
      throw new Error('Proxy non configuré — renseignez supabaseUrl dans js/config.js');
    }

    const anon = global.CDM_CONFIG?.supabaseAnonKey || '';
    const headers = { Accept: 'application/json' };
    if (anon) headers.Authorization = 'Bearer ' + anon;

    let lastErr = null;
    let lastStatus = 0;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const url = proxyUrl + (proxyUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);
        lastStatus = res.status;

        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.fixtures)) {
          return {
            fixtures: data.fixtures.map(normalizeFixture),
            fetchedAt: data.fetchedAt || new Date().toISOString(),
            source: data.source || 'worldcup26.ir',
            error: data.error || null,
          };
        }
        if (data.error) lastErr = new Error(data.error);
        else if (!res.ok) lastErr = new Error(`HTTP ${res.status}`);
        else lastErr = new Error('Réponse proxy invalide');
      } catch (e) {
        lastErr = e;
      }
      if (attempt < retries) await sleep(RETRY_BASE_MS * attempt);
    }

    const msg = friendlyFetchError(lastErr, lastStatus);
    const err = new Error(msg);
    err.cause = lastErr;
    err.httpStatus = lastStatus;
    throw err;
  }

  /** Index home|away → { num, home, away, reversed } pour GROUPS organisateur */
  function buildPouleIndex(groups) {
    const idx = {};
    Object.values(groups || {}).forEach((rows) => {
      rows.forEach(([num, home, away]) => {
        const fwd = normTeam(home) + '|' + normTeam(away);
        const rev = normTeam(away) + '|' + normTeam(home);
        idx[fwd] = { num, home, away, reversed: false };
        idx[rev] = { num, home, away, reversed: true };
      });
    });
    return idx;
  }

  function findPouleMatch(pouleIndex, homeFr, awayFr) {
    const key = normTeam(homeFr) + '|' + normTeam(awayFr);
    return pouleIndex[key] || null;
  }

  /**
   * Propositions d’import poules depuis les fixtures du jour.
   * @param {object[]} fixtures — sortie normalizeFixture
   * @param {object} pouleIndex — buildPouleIndex(GROUPS)
   * @param {object} opts — { includeLive, onlyFinished }
   */
  function proposePouleImports(fixtures, pouleIndex, opts = {}) {
    const includeLive = opts.includeLive !== false;
    const onlyFinished = opts.onlyFinished === true;
    const out = [];

    fixtures.forEach((fx) => {
      if (fx.scoreHome == null || fx.scoreAway == null) return;
      if (onlyFinished && !fx.isFinished) return;
      if (!includeLive && fx.isLive && !fx.isFinished) return;
      if (!fx.isLive && !fx.isFinished) return;

      const match = findPouleMatch(pouleIndex, fx.home, fx.away);
      if (!match) return;

      let sh = fx.scoreHome;
      let sa = fx.scoreAway;
      if (match.reversed) {
        sh = fx.scoreAway;
        sa = fx.scoreHome;
      }

      out.push({
        num: match.num,
        home: match.home,
        away: match.away,
        scoreHome: sh,
        scoreAway: sa,
        isLive: fx.isLive && !fx.isFinished,
        isFinished: fx.isFinished,
        group: fx.group,
        sourceLabel: fx.isLive && !fx.isFinished ? 'En cours' : 'Terminé',
      });
    });

    out.sort((a, b) => a.num - b.num);
    return out;
  }

  global.CDM_WC26 = {
    teamLabel,
    normTeam,
    getProxyUrl,
    fetchLiveFixtures,
    buildPouleIndex,
    proposePouleImports,
    friendlyFetchError,
  };
})(window);
