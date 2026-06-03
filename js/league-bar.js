/**
 * Bandeau ligue + liens d'invitation (toutes les pages joueur).
 */
(function (global) {
  const STYLE_ID = 'cdm-league-bar-styles';

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
.league-bar-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: .35rem;
  margin-top: .5rem;
}
.league-bar-tabs a {
  font-family: 'DM Mono', monospace;
  font-size: .62rem;
  letter-spacing: .08em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--muted, #8A8880);
  border: 1px solid rgba(200,168,75,0.25);
  border-radius: 3px;
  padding: .28rem .55rem;
  transition: color .15s, border-color .15s, background .15s;
}
.league-bar-tabs a:hover { color: var(--gold-light, #E4CE8A); border-color: var(--gold, #C8A84B); }
.league-bar-tabs a.is-active {
  color: var(--dark, #0A0A0F);
  background: var(--gold, #C8A84B);
  border-color: var(--gold, #C8A84B);
  font-weight: 600;
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

  function mount(containerId, page) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el || !global.CDM_LEAGUE) return;

    const L = CDM_LEAGUE;
    const cur = L.current();
    const curLabel = L.label(cur);
    const pageName = page || 'index.html';

    const tabs = Object.keys(L.LEAGUES).map(slug => {
      const href = pageName === 'index.html'
        ? L.indexUrl(slug)
        : pageName + L.pageQuery(slug, L.inviteFor(slug));
      const active = slug === cur ? ' is-active' : '';
      return '<a href="' + escapeHtml(href) + '" class="' + active.trim() + '">' + escapeHtml(L.label(slug)) + '</a>';
    }).join('');

    el.innerHTML =
      '<span class="league-bar-label">Ligue : <strong>' + escapeHtml(curLabel) + '</strong></span>'
      + '<span class="league-bar-hint">Chaque ligue a son classement · utilisez le lien reçu sur WhatsApp</span>'
      + '<div class="league-bar-tabs">' + tabs + '</div>';

    const nameEl = document.querySelector('.edition-name');
    if (nameEl) nameEl.textContent = curLabel;
    const subEl = document.querySelector('header .subtitle');
    if (subEl && /CDM 2026/i.test(subEl.textContent)) {
      subEl.textContent = 'CDM 2026 · édition ' + curLabel;
    }
    document.title = document.title.replace(/Pains sucés|Peuple|Compet 1|Compet 2/g, curLabel);

    document.querySelectorAll('a[href$="classement.html"], a[href$="mon-score.html"], a[href$="guide.html"], a[href^="index.html"]').forEach(a => {
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('http')) return;
      const base = raw.split('#')[0].split('?')[0];
      if (['classement.html', 'mon-score.html', 'guide.html', 'index.html'].includes(base) || raw.startsWith('index.html')) {
        const hash = raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
        a.setAttribute('href', L.withLeague(base + hash));
      }
    });
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

  global.CDM_LEAGUE_BAR = { mount, updateInviteGate, injectStyles };
})(window);
