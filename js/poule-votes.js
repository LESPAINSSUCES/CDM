/**
 * Agrégation des pronos poules (1X2) — ligue courante via Supabase.
 * Affichage : domicile · nul · extérieur sur N inscrits.
 */
(function (global) {
  const MATCH_MIN = 1;
  const MATCH_MAX = 72;

  let cache = {
    totalInscrits: 0,
    byMatch: {},
    loaded: false,
    loading: false,
  };

  function parseIntSafe(v) {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function matchOutcome(h, a) {
    if (h == null || a == null) return null;
    if (h > a) return 'H';
    if (h < a) return 'A';
    return 'D';
  }

  function getMatchFromPayload(matchs, num) {
    if (!matchs) return null;
    const keys = ['Match ' + num, 'M' + num, String(num)];
    for (const k of keys) {
      if (matchs[k]) return matchs[k];
    }
    return null;
  }

  function emptyCounts() {
    return { H: 0, D: 0, A: 0 };
  }

  function initByMatch() {
    const byMatch = {};
    for (let n = MATCH_MIN; n <= MATCH_MAX; n++) byMatch[n] = emptyCounts();
    return byMatch;
  }

  function aggregateParticipants(participants) {
    const byMatch = initByMatch();
    const totalInscrits = participants.length;

    participants.forEach(p => {
      const matchs = p.matchs || {};
      for (let n = MATCH_MIN; n <= MATCH_MAX; n++) {
        const m = getMatchFromPayload(matchs, n);
        if (!m) continue;
        const h = parseIntSafe(m.scoreHome);
        const a = parseIntSafe(m.scoreAway);
        const out = matchOutcome(h, a);
        if (!out) continue;
        byMatch[n][out]++;
      }
    });

    return { totalInscrits, byMatch };
  }

  async function refresh() {
    if (cache.loading) return cache;
    cache.loading = true;
    try {
      if (!global.CDM_SUPABASE?.isConfigured?.()) {
        cache = { totalInscrits: 0, byMatch: initByMatch(), loaded: true, loading: false };
        return cache;
      }
      const rows = await global.CDM_SUPABASE.fetchAllGrilles();
      const participants = rows.map(r => global.CDM_SUPABASE.rowToParticipant(r));
      const agg = aggregateParticipants(participants);
      cache = { ...agg, loaded: true, loading: false };
    } catch (e) {
      console.warn('poule-votes:', e);
      cache = { ...cache, loaded: true, loading: false };
    }
    return cache;
  }

  function getMatchVotes(num) {
    const n = Number(num);
    return cache.byMatch[n] || emptyCounts();
  }

  function getTotalInscrits() {
    return cache.totalInscrits || 0;
  }

  function isLoaded() {
    return !!cache.loaded;
  }

  global.CDM_POULE_VOTES = {
    refresh,
    getMatchVotes,
    getTotalInscrits,
    isLoaded,
  };
})(window);
