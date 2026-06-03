/**
 * Ligues + codes d'invitation (un lien d'invitation par groupe).
 * ?ligue= dans l'URL ; sans paramètre → pains-suces.
 * ?invite= obligatoire pour une nouvelle inscription (vérif serveur).
 */
(function (global) {
  const LEAGUES = {
    'pains-suces': { label: 'Pains sucés', invite: 'painssuces26' },
    'peuple': { label: 'Peuple', invite: 'peuple26' },
    'compet1': { label: 'Compet 1', invite: 'compet1-26' },
    'compet2': { label: 'Compet 2', invite: 'compet2-26' },
  };
  const DEFAULT = 'pains-suces';
  const SS_INVITE_KEY = 'cdm2026_invite';

  function normalize(s) {
    return String(s || '').trim().toLowerCase();
  }

  function isValid(slug) {
    return Object.prototype.hasOwnProperty.call(LEAGUES, slug);
  }

  function inviteFor(slug) {
    return LEAGUES[slug]?.invite || '';
  }

  function current() {
    try {
      const param = new URLSearchParams(global.location.search).get('ligue');
      if (param) {
        const s = normalize(param);
        if (isValid(s)) return s;
      }
    } catch (e) { /* ignore */ }
    return DEFAULT;
  }

  function readInviteFromUrl() {
    try {
      return String(new URLSearchParams(global.location.search).get('invite') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function currentInvite() {
    try {
      const expected = inviteFor(current());
      const fromUrl = readInviteFromUrl();
      if (fromUrl) {
        try { sessionStorage.setItem(SS_INVITE_KEY, fromUrl); } catch (e) { /* ignore */ }
        return fromUrl;
      }
      const saved = sessionStorage.getItem(SS_INVITE_KEY);
      if (saved && normalize(saved) === normalize(expected)) return String(saved).trim();
      return '';
    } catch (e) {
      return readInviteFromUrl();
    }
  }

  function hasValidInvite(league) {
    const lg = league || current();
    const expected = inviteFor(lg);
    if (!expected) return true;
    const got = normalize(currentInvite());
    return got === normalize(expected);
  }

  function label(slug) {
    return LEAGUES[slug]?.label || LEAGUES[DEFAULT].label;
  }

  /** Invite propagée dans les liens seulement si l'utilisateur a déjà le bon code (URL / session). */
  function inviteToPropagate(slug) {
    const lg = slug || current();
    return hasValidInvite(lg) ? currentInvite() : '';
  }

  function pageQuery(slug, invite) {
    const lg = slug || current();
    const inv = invite !== undefined ? (invite || '') : inviteToPropagate(lg);
    const parts = ['ligue=' + encodeURIComponent(lg)];
    if (inv) parts.push('invite=' + encodeURIComponent(inv));
    return '?' + parts.join('&');
  }

  function withLeague(href, slug) {
    const lg = slug || current();
    const inv = inviteToPropagate(lg);
    const hash = (href.indexOf('#') >= 0) ? href.slice(href.indexOf('#')) : '';
    const base = hash ? href.slice(0, href.indexOf('#')) : href;
    const pathOnly = base.split('?')[0].replace(/^\.\//, '') || 'index.html';
    if (pathOnly === 'index.html') return indexUrl(lg) + hash;
    const merged = new URLSearchParams();
    merged.set('ligue', lg);
    if (inv) merged.set('invite', inv);
    if (base.includes('?')) {
      const existing = new URLSearchParams(base.split('?')[1]);
      existing.forEach((v, k) => {
        if (k !== 'ligue' && k !== 'invite') merged.set(k, v);
      });
    }
    return pathOnly + '?' + merged.toString() + hash;
  }

  function indexUrl(slug) {
    const lg = slug || current();
    return 'index.html' + pageQuery(lg);
  }

  function pageUrl(page, slug) {
    const path = String(page || '').split('?')[0].split('#')[0].replace(/^\.\//, '');
    return path + pageQuery(slug || current());
  }

  global.CDM_LEAGUE = {
    LEAGUES,
    DEFAULT,
    current,
    currentInvite,
    hasValidInvite,
    inviteFor,
    label,
    isValid,
    normalize,
    inviteToPropagate,
    withLeague,
    pageQuery,
    pageUrl,
    indexUrl,
  };
})(window);
