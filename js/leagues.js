/**
 * Ligues du concours. La ligue courante vient de ?ligue= dans l'URL
 * (lien d'invitation), sinon sessionStorage (navigation), sinon défaut.
 * Le défaut 'pains-suces' garantit que les inscrits historiques (sans ?ligue=)
 * retombent toujours sur leur ligue d'origine.
 */
(function (global) {
  const LEAGUES = {
    'pains-suces': { label: 'Pains sucés' },
    'peuple': { label: 'Peuple' },
    'compet1': { label: 'Compet 1' },
    'compet2': { label: 'Compet 2' },
  };
  const DEFAULT = 'pains-suces';
  const SS_KEY = 'cdm2026_league';

  function normalize(s) {
    return String(s || '').trim().toLowerCase();
  }

  function isValid(slug) {
    return Object.prototype.hasOwnProperty.call(LEAGUES, slug);
  }

  function current() {
    try {
      const param = new URLSearchParams(global.location.search).get('ligue');
      if (param) {
        const s = normalize(param);
        if (isValid(s)) {
          try { sessionStorage.setItem(SS_KEY, s); } catch (e) { /* ignore */ }
          return s;
        }
      }
      const saved = normalize(sessionStorage.getItem(SS_KEY));
      if (saved && isValid(saved)) return saved;
    } catch (e) { /* ignore */ }
    return DEFAULT;
  }

  function label(slug) {
    return LEAGUES[slug]?.label || LEAGUES[DEFAULT].label;
  }

  function withLeague(href, slug) {
    const lg = slug || current();
    if (!lg || lg === DEFAULT) return href;
    return href + (href.includes('?') ? '&' : '?') + 'ligue=' + encodeURIComponent(lg);
  }

  global.CDM_LEAGUE = { LEAGUES, DEFAULT, current, label, isValid, normalize, withLeague };
})(window);
