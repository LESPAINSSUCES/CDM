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
    const elapsedRaw = String(f.status?.elapsedRaw || '').trim().toLowerCase();
    let short = f.status?.short || 'NS';
    if (short === 'NS' && elapsedRaw === 'finished') short = 'FT';
    const kickoffIso = f.fixture?.date || null;
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
      koType: f.koType || '',
      homeTeamId: f.homeTeamId || '0',
      awayTeamId: f.awayTeamId || '0',
      kickoffIso,
      raw: f,
    };
  }

  function isKnownNationName(name, knownNations) {
    const n = normTeam(teamLabel(name));
    if (!n) return false;
    return (knownNations || []).some((t) => normTeam(t) === n);
  }

  function koTeamAcceptable(name, knownNations) {
    const n = teamLabel(name);
    if (!n) return false;
    if (isRealKoTeam(n)) return true;
    return isKnownNationName(n, knownNations);
  }

  /** M73–M104 → ISO 8601 (UTC) depuis fixtures normalisées. */
  function buildKickoffMap(fixtures, opts = {}) {
    const minMid = opts.minMid ?? 73;
    const maxMid = opts.maxMid ?? 104;
    const out = {};
    (fixtures || []).forEach((fx) => {
      const mid = parseInt(String(fx.matchId || ''), 10);
      if (!Number.isFinite(mid) || mid < minMid || mid > maxMid) return;
      const iso = fx.kickoffIso || fx.fixture?.date || '';
      if (iso) out[String(mid)] = iso;
    });
    return out;
  }

  function mergeKickoffsIntoState(state, fixtures, opts = {}) {
    if (!state) return {};
    if (!state.heuresCoupEnvoiKo) state.heuresCoupEnvoiKo = {};
    const incoming = buildKickoffMap(fixtures, opts);
    Object.assign(state.heuresCoupEnvoiKo, incoming);
    return incoming;
  }

  function formatKickoffParis(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
  }

  function koImportSkipReason(home, away, knownNations) {
    const h = teamLabel(home);
    const a = teamLabel(away);
    if (!koTeamAcceptable(h, knownNations)) return `Domicile non confirmé (${h || '—'})`;
    if (!koTeamAcceptable(a, knownNations)) return `Extérieur non confirmé (${a || '—'})`;
    return '';
  }

  function isPlaceholderTeam(name) {
    const s = String(name || '').trim();
    if (!s || s === '—') return true;
    return /^(Winner|Runner-up|Runner up|Runner-Up|Loser|3rd|2nd|Winner Match|Loser Match|TBD)/i.test(s)
      || /\bGroup [A-L]\b/i.test(s)
      || /^3rd Group/i.test(s);
  }

  function isRealKoTeam(name) {
    const n = teamLabel(name);
    return !!n && !isPlaceholderTeam(n);
  }

  function koTypeLabel(koType) {
    const t = String(koType || '').toLowerCase();
    if (t === 'r32') return 'Seizième';
    if (t === 'r16') return 'Huitième';
    if (t === 'qf') return 'Quart';
    if (t === 'sf') return 'Demi';
    if (t === 'third') return 'Petite finale';
    if (t === 'final') return 'Finale';
    return t || 'KO';
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
        const qs = new URLSearchParams({ t: String(Date.now()) });
        if (options.windowHours > 0) qs.set('window', String(options.windowHours) + 'h');
        if (options.scope) qs.set('scope', String(options.scope));
        const sep = proxyUrl.includes('?') ? '&' : '?';
        const url = proxyUrl + sep + qs.toString();
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
            windowHours: data.windowHours || options.windowHours || null,
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
    const onlyEmpty = opts.onlyEmpty === true;
    const isPouleEmpty = typeof opts.isPouleEmpty === 'function' ? opts.isPouleEmpty : null;
    const out = [];

    fixtures.forEach((fx) => {
      if (fx.scoreHome == null || fx.scoreAway == null) return;
      if (onlyFinished && !fx.isFinished) return;
      if (!includeLive && fx.isLive && !fx.isFinished) return;
      if (!fx.isLive && !fx.isFinished) return;

      const match = findPouleMatch(pouleIndex, fx.home, fx.away);
      if (!match) return;
      if (onlyEmpty && isPouleEmpty && !isPouleEmpty(match.num)) return;

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

  /**
   * Affrontements KO (M73–M104) depuis worldcup26 — équipes réelles uniquement.
   */
  function proposeKoTeamImports(fixtures, opts = {}) {
    const minMid = opts.minMid ?? 73;
    const maxMid = opts.maxMid ?? 104;
    const onlyEmpty = opts.onlyEmpty !== false;
    const isSlotEmpty = typeof opts.isSlotEmpty === 'function' ? opts.isSlotEmpty : null;
    const knownNations = opts.knownNations || null;
    const out = [];

    fixtures.forEach((fx) => {
      const mid = parseInt(String(fx.matchId || ''), 10);
      if (!Number.isFinite(mid) || mid < minMid || mid > maxMid) return;
      const home = teamLabel(fx.home);
      const away = teamLabel(fx.away);
      if (!koTeamAcceptable(home, knownNations) || !koTeamAcceptable(away, knownNations)) return;
      if (onlyEmpty && isSlotEmpty && !isSlotEmpty(mid)) return;
      out.push({
        mid,
        home,
        away,
        koType: fx.koType || '',
        kickoffIso: fx.kickoffIso || '',
        sourceLabel: koTypeLabel(fx.koType),
      });
    });

    out.sort((a, b) => a.mid - b.mid);
    return out;
  }

  /** Matchs KO visibles mais non importables (worldcup26 en retard / placeholder). */
  function listKoTeamImportSkipped(fixtures, opts = {}) {
    const minMid = opts.minMid ?? 73;
    const maxMid = opts.maxMid ?? 104;
    const knownNations = opts.knownNations || null;
    const importable = new Set(proposeKoTeamImports(fixtures, { ...opts, onlyEmpty: false }).map((r) => r.mid));
    const out = [];
    fixtures.forEach((fx) => {
      const mid = parseInt(String(fx.matchId || ''), 10);
      if (!Number.isFinite(mid) || mid < minMid || mid > maxMid) return;
      if (importable.has(mid)) return;
      const home = teamLabel(fx.home);
      const away = teamLabel(fx.away);
      const reason = koImportSkipReason(home, away, knownNations);
      if (!reason) return;
      out.push({ mid, home, away, reason, koType: fx.koType || '' });
    });
    out.sort((a, b) => a.mid - b.mid);
    return out;
  }

  /**
   * Scores KO terminés / live (M73–M104).
   */
  function proposeKoScoreImports(fixtures, opts = {}) {
    const minMid = opts.minMid ?? 73;
    const maxMid = opts.maxMid ?? 104;
    const includeLive = opts.includeLive !== false;
    const onlyFinished = opts.onlyFinished === true;
    const onlyEmpty = opts.onlyEmpty !== false;
    const isScoreEmpty = typeof opts.isScoreEmpty === 'function' ? opts.isScoreEmpty : null;
    const out = [];

    fixtures.forEach((fx) => {
      const mid = parseInt(String(fx.matchId || ''), 10);
      if (!Number.isFinite(mid) || mid < minMid || mid > maxMid) return;
      if (fx.scoreHome == null || fx.scoreAway == null) return;
      if (!koTeamAcceptable(fx.home, opts.knownNations) || !koTeamAcceptable(fx.away, opts.knownNations)) return;
      if (onlyFinished && !fx.isFinished) return;
      if (!includeLive && fx.isLive && !fx.isFinished) return;
      if (!fx.isLive && !fx.isFinished) return;
      if (onlyEmpty && isScoreEmpty && !isScoreEmpty(mid)) return;

      out.push({
        mid,
        home: teamLabel(fx.home),
        away: teamLabel(fx.away),
        scoreHome: fx.scoreHome,
        scoreAway: fx.scoreAway,
        koType: fx.koType || '',
        isLive: fx.isLive && !fx.isFinished,
        isFinished: fx.isFinished,
        sourceLabel: fx.isLive && !fx.isFinished ? 'En cours' : 'Terminé',
      });
    });

    out.sort((a, b) => a.mid - b.mid);
    return out;
  }

  async function fetchKnockoutFixtures(options = {}) {
    return fetchLiveFixtures({ ...options, scope: 'knockout', windowHours: 0 });
  }

  global.CDM_WC26 = {
    teamLabel,
    normTeam,
    getProxyUrl,
    fetchLiveFixtures,
    fetchKnockoutFixtures,
    buildPouleIndex,
    proposePouleImports,
    proposeKoTeamImports,
    listKoTeamImportSkipped,
    proposeKoScoreImports,
    buildKickoffMap,
    mergeKickoffsIntoState,
    formatKickoffParis,
    koTeamAcceptable,
    isPlaceholderTeam,
    isRealKoTeam,
    koTypeLabel,
    friendlyFetchError,
  };
})(window);
