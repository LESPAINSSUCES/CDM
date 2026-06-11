/**
 * Scores CDM en direct (info seulement — n’alimente pas resultats.json).
 * Appelle une Edge Function Supabase qui proxy API-Football (clé côté serveur).
 */
(function (global) {
  const FIFA_SCORES_URL = 'https://www.fifa.com/fr/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=FR&wtw-filter=ALL';
  const REFRESH_MS = 5.5 * 60 * 1000; // 5 min 30 — limite quota API-Football (100/jour)
  const CDM_WINDOW_START = new Date('2026-06-01T00:00:00');
  const CDM_WINDOW_END = new Date('2026-07-31T23:59:59');
  const LS_EMAIL_KEY = 'cdm2026_email';

  function isCdmSeason(now = new Date()) {
    return now >= CDM_WINDOW_START && now <= CDM_WINDOW_END;
  }

  function renderOffSeason(root) {
    root.innerHTML = `
      <div class="live-scores-head">
        <h2 class="live-scores-title">⚽ Scores FIFA (info live)</h2>
      </div>
      <p class="live-scores-msg">Scores live disponibles pendant la CDM (juin–juillet 2026). Les points du concours restent sur le classement officiel.</p>
      <p class="live-scores-foot"><a href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">Scores & calendrier FIFA →</a></p>`;
  }

  /** Noms API-Football → libellés français du concours */
  const API_TO_FR = {
    'Mexico': 'Mexique',
    'South Africa': 'Afrique du Sud',
    'South Korea': 'Corée du Sud',
    'Korea Republic': 'Corée du Sud',
    'Czech Republic': 'Rép. Tchèque',
    'Czechia': 'Rép. Tchèque',
    'Canada': 'Canada',
    'Bosnia and Herzegovina': 'Bosnie Herzégovine',
    'Bosnia-Herzegovina': 'Bosnie Herzégovine',
    'Qatar': 'Qatar',
    'Switzerland': 'Suisse',
    'Brazil': 'Brésil',
    'Morocco': 'Maroc',
    'Haiti': 'Haïti',
    'Scotland': 'Écosse',
    'USA': 'États-Unis',
    'United States': 'États-Unis',
    'Paraguay': 'Paraguay',
    'Australia': 'Australie',
    'Turkey': 'Turquie',
    'Germany': 'Allemagne',
    'Curacao': 'Curacao',
    'Côte d\'Ivoire': 'Côte d\'Ivoire',
    'Ivory Coast': 'Côte d\'Ivoire',
    'Ecuador': 'Équateur',
    'Netherlands': 'Pays-Bas',
    'Japan': 'Japon',
    'Sweden': 'Suède',
    'Tunisia': 'Tunisie',
    'Belgium': 'Belgique',
    'Egypt': 'Égypte',
    'Iran': 'Iran',
    'New Zealand': 'Nouvelle Zélande',
    'Spain': 'Espagne',
    'Cape Verde': 'Cap Vert',
    'Saudi Arabia': 'Arabie Saoudite',
    'Uruguay': 'Uruguay',
    'France': 'France',
    'Senegal': 'Sénégal',
    'Iraq': 'Irak',
    'Norway': 'Norvège',
    'Argentina': 'Argentine',
    'Algeria': 'Algérie',
    'Austria': 'Autriche',
    'Jordan': 'Jordanie',
    'Portugal': 'Portugal',
    'DR Congo': 'RD Congo',
    'Congo DR': 'RD Congo',
    'Uzbekistan': 'Ouzbékistan',
    'Colombia': 'Colombie',
    'England': 'Angleterre',
    'Croatia': 'Croatie',
    'Ghana': 'Ghana',
    'Panama': 'Panama',
    'Poland': 'Pologne',
    'Ukraine': 'Ukraine',
    'Denmark': 'Danemark',
    'Wales': 'Pays de Galles',
    'Serbia': 'Serbie',
    'Cameroon': 'Cameroun',
    'Costa Rica': 'Costa Rica',
    'Peru': 'Pérou',
    'Chile': 'Chili',
    'Italy': 'Italie',
    'Russia': 'Russie',
    'Nigeria': 'Nigeria',
    'Slovenia': 'Slovénie',
    'Slovakia': 'Slovaquie',
    'Romania': 'Roumanie',
    'Hungary': 'Hongrie',
    'Greece': 'Grèce',
    'Ireland': 'Irlande',
    'Northern Ireland': 'Irlande du Nord',
    'Finland': 'Finlande',
    'Iceland': 'Islande',
    'Albania': 'Albanie',
    'Georgia': 'Géorgie',
    'Bolivia': 'Bolivie',
    'Venezuela': 'Venezuela',
    'Jamaica': 'Jamaïque',
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function teamLabel(name) {
    return API_TO_FR[name] || name || '—';
  }

  function statusLabel(f) {
    const st = f.status || {};
    const short = st.short || '';
    if (short === 'LIVE' || short === '1H' || short === '2H' || short === 'HT' || short === 'ET' || short === 'P') {
      const elapsed = st.elapsed != null ? st.elapsed + '′' : 'En cours';
      return { text: elapsed, live: true };
    }
    if (short === 'FT' || short === 'AET' || short === 'PEN') return { text: 'Terminé', live: false };
    if (short === 'NS' || short === 'TBD') {
      const d = f.fixture?.date ? new Date(f.fixture.date) : null;
      const t = d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
      return { text: t, live: false };
    }
    return { text: st.long || short || '—', live: false };
  }

  function getFunctionUrl() {
    const cfg = global.CDM_CONFIG || {};
    if (cfg.liveScoresUrl) return cfg.liveScoresUrl;
    if (cfg.supabaseUrl) return cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/live-scores';
    return '';
  }

  async function fetchFixtures() {
    const url = getFunctionUrl();
    if (!url) throw new Error('liveScoresUrl non configuré');
    const anon = global.CDM_CONFIG?.supabaseAnonKey || '';
    const headers = { Accept: 'application/json' };
    if (anon) headers.Authorization = 'Bearer ' + anon;
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function renderWidget(root, data) {
    const fixtures = data?.fixtures || [];
    const err = data?.error;
    const updated = data?.fetchedAt
      ? new Date(data.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let body;
    if (err && !fixtures.length) {
      body = `<p class="live-scores-msg">${escapeHtml(err)}</p>`;
    } else if (!fixtures.length) {
      body = `<p class="live-scores-msg">Aucun match CDM aujourd’hui. Le widget s’active pendant la compétition (juin–juillet 2026).</p>
        <p class="live-scores-foot"><a href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">Scores & calendrier FIFA →</a></p>`;
    } else {
      body = `<ul class="live-scores-list">${fixtures.map(f => {
        const home = teamLabel(f.teams?.home?.name);
        const away = teamLabel(f.teams?.away?.name);
        const gh = f.goals?.home;
        const ga = f.goals?.away;
        const hasScore = gh != null && ga != null;
        const score = hasScore ? `${gh} – ${ga}` : 'vs';
        const st = statusLabel(f);
        return `<li class="live-scores-item${st.live ? ' is-live' : ''}">
          <span class="live-scores-status">${st.live ? '🔴' : '⚪'} ${escapeHtml(st.text)}</span>
          <span class="live-scores-teams">${escapeHtml(home)} <strong>${escapeHtml(score)}</strong> ${escapeHtml(away)}</span>
        </li>`;
      }).join('')}</ul>`;
    }

    root.innerHTML = `
      <div class="live-scores-head">
        <h2 class="live-scores-title">⚽ Scores FIFA (info live)</h2>
        <span class="live-scores-updated">Màj ${escapeHtml(updated)} · refresh ~6 min</span>
      </div>
      ${body}
      <p class="live-scores-foot">Scores indicatifs — les points du concours viennent de l’organisateur (<code>resultats.json</code>).</p>`;
  }

  async function refresh(root) {
    if (!root) return;
    root.classList.add('loading');
    try {
      const data = await fetchFixtures();
      renderWidget(root, data);
    } catch (e) {
      root.innerHTML = `
        <div class="live-scores-head"><h2 class="live-scores-title">⚽ Scores FIFA (info live)</h2></div>
        <p class="live-scores-msg">Scores live indisponibles (${escapeHtml(e.message)}). Déployez l’Edge Function <code>live-scores</code> (voir scripts/LIVE_SCORES_SETUP.md).</p>
        <p class="live-scores-foot"><a href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">Scores & calendrier FIFA →</a></p>`;
    } finally {
      root.classList.remove('loading');
    }
  }

  function mount(containerId) {
    const root = document.getElementById(containerId);
    if (!root) return;
    if (!isCdmSeason()) {
      renderOffSeason(root);
      return;
    }
    refresh(root);
    setInterval(() => refresh(root), REFRESH_MS);
  }

  global.CDM_LIVE_SCORES = { mount, refresh, getStoredEmail: () => {
    try { return localStorage.getItem(LS_EMAIL_KEY) || ''; } catch (e) { return ''; }
  } };
})(window);
