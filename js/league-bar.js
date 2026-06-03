/**
 * Bandeau ligue + correction des liens navigation (classement, mon-score, guide, index).
 */
(function (global) {
  const STYLE_ID = 'cdm-league-bar-styles';
  const NAV_PAGES = ['classement.html', 'mon-score.html', 'guide.html', 'index.html'];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
.league-bar {
  text-align: center;
  font-size: .78rem;
  color: var(--muted, #8A8880);
  background: rgba(200,168,75,0.06);
  border-bottom: 1px solid rgba(200,168,75,0.2);
  padding: .55rem 1rem .65rem;
  line-height: 1.45;
}
.league-bar strong { color: var(--text, #F0EDE5); }
.league-bar-hint {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: .62rem;
  letter-spacing: .06em;
  margin-top: .35rem;
  color: var(--muted, #8A8880);
}
.invite-gate {
  margin: 1rem 0 0;
  padding: .85rem 1rem;
  background: rgba(240,173,78,0.12);
  border: 1px solid rgba(240,173,78,0.4);
  border-radius: 6px;
  font-size: .88rem;
  color: #f0d9a8;
  line-height: 1.5;
}
.invite-gate[hidden] { display: none !important; }
body.league-invite-blocked .panel:not(#tab-identity),
body.league-invite-blocked #tabs button:not([data-tab="identity"]),
body.league-invite-blocked #tabs .tab-link { pointer-events: none; opacity: 0.35; }
body.league-invite-blocked #tab-identity .identity-card { opacity: 0.45; pointer-events: none; }
`;
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function pathOnly(href) {
    if (!href || /^https?:\/\//i.test(href) || href.startsWith('mailto:')) return '';
    const noHash = href.split('#')[0];
    return noHash.split('?')[0].replace(/^\.\//, '').toLowerCase();
  }

  /** Réécrit tous les liens internes pour garder ligue + invite (ligue courante de la page). */
  function wireNavLinks(leagueSlug) {
    if (!global.CDM_LEAGUE) return;
    const L = CDM_LEAGUE;
    const lg = leagueSlug || L.current();

    document.querySelectorAll('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      const base = pathOnly(raw);
      if (!base || !NAV_PAGES.includes(base)) return;
      const hash = raw && raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
      if (base === 'index.html') {
        a.setAttribute('href', L.indexUrl(lg) + hash);
      } else {
        a.setAttribute('href', base + L.pageQuery(lg, L.inviteFor(lg)) + hash);
      }
    });
  }

  function mount(containerId, page) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el || !global.CDM_LEAGUE) return;

    const L = CDM_LEAGUE;
    const cur = L.current();
    const curLabel = L.label(cur);

    el.innerHTML =
      '<span class="league-bar-label">Ligue : <strong>' + escapeHtml(curLabel) + '</strong></span>'
      + '<span class="league-bar-hint">Classement et grille propres à ce groupe · lien d’invitation WhatsApp uniquement</span>';

    const nameEl = document.querySelector('.edition-name');
    if (nameEl) nameEl.textContent = curLabel;
    const subEl = document.querySelector('header .subtitle');
    if (subEl && /CDM 2026/i.test(subEl.textContent)) {
      subEl.textContent = 'CDM 2026 · édition ' + curLabel;
    }
    document.title = document.title.replace(/Pains sucés|Peuple|Compet 1|Compet 2/g, curLabel);

    wireNavLinks(cur);
  }

  function updateInviteGate(opts) {
    const gate = document.getElementById('invite-gate');
    if (!gate || !global.CDM_LEAGUE) return;
    const allowed = opts && opts.allowed;
    const show = allowed === false;
    gate.hidden = !show;
    document.body.classList.toggle('league-invite-blocked', show);
    if (show) {
      const lbl = CDM_LEAGUE.label(CDM_LEAGUE.current());
      gate.innerHTML =
        '<strong>Inscription réservée</strong> — pour rejoindre la ligue <em>' + escapeHtml(lbl) + '</em>, '
        + 'ouvrez le <strong>lien d’invitation</strong> envoyé par l’organisateur (groupe WhatsApp). '
        + 'Sans ce lien, vous ne pouvez pas créer de grille ici.';
    }
  }

  function bootWire() {
    if (global.CDM_LEAGUE) wireNavLinks();
  }

  global.CDM_LEAGUE_BAR = { mount, updateInviteGate, injectStyles, wireNavLinks, bootWire };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWire);
  } else {
    bootWire();
  }
})(window);
