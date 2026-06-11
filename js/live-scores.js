/**
 * Scores CDM (info seulement — n’alimente pas le barème).
 * Sources gratuites : openfootball/worldcup.json + resultats.json (organisateur) + lien FIFA live.
 */
(function (global) {
  const FIFA_SCORES_URL = 'https://www.fifa.com/fr/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=FR&wtw-filter=ALL';
  const OPENFOOTBALL_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
  const REFRESH_MS = 5 * 60 * 1000;
  const CDM_WINDOW_START = new Date('2026-06-01T00:00:00');
  const CDM_WINDOW_END = new Date('2026-07-31T23:59:59');
  const MATCH_DURATION_MS = (2 * 60 + 15) * 60 * 1000; // 2 h 15
  const LS_EMAIL_KEY = 'cdm2026_email';

  const EN_TO_FR = {
    'Mexico': 'Mexique',
    'South Africa': 'Afrique du Sud',
    'South Korea': 'Corée du Sud',
    'Korea Republic': 'Corée du Sud',
    'Czech Republic': 'Rép. Tchèque',
    'Czechia': 'Rép. Tchèque',
    'Canada': 'Canada',
    'Bosnia & Herzegovina': 'Bosnie Herzégovine',
    'Bosnia and Herzegovina': 'Bosnie Herzégovine',
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
    'Curaçao': 'Curacao',
    'Curacao': 'Curacao',
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
    'Uzbekistan': 'Ouzbékistan',
    'Colombia': 'Colombie',
    'England': 'Angleterre',
    'Croatia': 'Croatie',
    'Ghana': 'Ghana',
    'Panama': 'Panama',
  };

  function isCdmSeason(now = new Date()) {
    return now >= CDM_WINDOW_START && now <= CDM_WINDOW_END;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function teamLabel(name) {
    if (!name || /^[12WL3][A-L0-9/]+$/.test(name)) return name;
    return EN_TO_FR[name] || name;
  }

  function normTeam(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
  }

  function parseKickoffUtc(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const m = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*UTC([+-]?\d+(?:\.\d+)?)?$/i);
    if (!m) return null;
    const offset = parseFloat(m[3] || '0');
    const localH = parseInt(m[1], 10);
    const localM = parseInt(m[2], 10);
    const utcMs = Date.UTC(
      parseInt(dateStr.slice(0, 4), 10),
      parseInt(dateStr.slice(5, 7), 10) - 1,
      parseInt(dateStr.slice(8, 10), 10),
      localH - offset,
      localM,
      0,
    );
    return new Date(utcMs);
  }

  function todayParis() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  }

  function findOrgScore(resultats, homeFr, awayFr) {
    const matchs = resultats?.matchs;
    if (!matchs) return null;
    const h = normTeam(homeFr);
    const a = normTeam(awayFr);
    for (const row of Object.values(matchs)) {
      if (!row || normTeam(row.home) !== h || normTeam(row.away) !== a) continue;
      const sh = row.scoreHome;
      const sa = row.scoreAway;
      if (sh !== '' && sh != null && sa !== '' && sa != null) {
        return { home: sh, away: sa, source: 'orga' };
      }
    }
    return null;
  }

  function matchStatus(kickoff, score, now = new Date()) {
    if (score) return { text: 'Terminé', live: false };
    if (!kickoff) return { text: '—', live: false };
    const t = kickoff.getTime();
    const n = now.getTime();
    if (n < t - 5 * 60 * 1000) {
      return {
        text: kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        live: false,
      };
    }
    if (n <= t + MATCH_DURATION_MS) {
      return { text: 'En cours', live: true };
    }
    return { text: 'Terminé ?', live: false };
  }

  async function fetchResultats() {
    try {
      const res = await fetch('data/resultats.json?t=' + Date.now());
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchTodayMatches() {
    const [wcRes, resultats] = await Promise.all([
      fetch(OPENFOOTBALL_URL + '?t=' + Date.now()),
      fetchResultats(),
    ]);
    if (!wcRes.ok) throw new Error('Calendrier openfootball indisponible');
    const wc = await wcRes.json();
    const day = todayParis();

    const rows = (wc.matches || [])
      .filter((m) => m.date === day)
      .map((m) => {
        const kickoff = parseKickoffUtc(m.date, m.time);
        const home = teamLabel(m.team1);
        const away = teamLabel(m.team2);
        const orgScore = findOrgScore(resultats, home, away);
        const openHome = m.score1 ?? m.score?.[0];
        const openAway = m.score2 ?? m.score?.[1];
        const openScore = openHome != null && openAway != null
          ? { home: openHome, away: openAway, source: 'openfootball' }
          : null;
        const score = orgScore || openScore;
        const status = matchStatus(kickoff, score);
        return { home, away, score, status, kickoff, round: m.round, group: m.group };
      })
      .sort((a, b) => (a.kickoff?.getTime() || 0) - (b.kickoff?.getTime() || 0));

    return { rows, fetchedAt: new Date().toISOString(), resultatsMaj: resultats?.meta?.misAJour || '' };
  }

  function renderFifaCta() {
    return `<a class="live-scores-fifa-cta" href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">🔴 Scores live sur FIFA.com →</a>`;
  }

  function renderWidget(root, data) {
    const { rows, fetchedAt, resultatsMaj } = data;
    const updated = new Date(fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const hasLive = rows.some((r) => r.status.live);

    let body;
    if (!rows.length) {
      body = `<p class="live-scores-msg">Pas de match au calendrier aujourd’hui (fuseau France).</p>`;
    } else {
      body = `<ul class="live-scores-list">${rows.map((r) => {
        const score = r.score
          ? `${escapeHtml(String(r.score.home))} – ${escapeHtml(String(r.score.away))}`
          : 'vs';
        const st = r.status;
        const tag = r.score?.source === 'orga' ? ' · concours' : '';
        return `<li class="live-scores-item${st.live ? ' is-live' : ''}">
          <span class="live-scores-status">${st.live ? '🔴' : '⚪'} ${escapeHtml(st.text)}</span>
          <span class="live-scores-teams">${escapeHtml(r.home)} <strong>${score}</strong> ${escapeHtml(r.away)}</span>
          ${r.group ? `<span class="live-scores-meta">${escapeHtml(r.group)}</span>` : ''}${tag ? `<span class="live-scores-meta">${tag.trim()}</span>` : ''}
        </li>`;
      }).join('')}</ul>`;
    }

    root.innerHTML = `
      <div class="live-scores-head">
        <h2 class="live-scores-title">⚽ CDM 2026 — matchs du jour</h2>
        <span class="live-scores-updated">Màj ${escapeHtml(updated)} · refresh 5 min</span>
      </div>
      ${renderFifaCta()}
      ${hasLive ? '<p class="live-scores-msg live-scores-hint">Match probablement en cours — voir le score minute par minute sur FIFA.</p>' : ''}
      ${body}
      <p class="live-scores-foot">Calendrier <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noopener">openfootball</a> (gratuit)${resultatsMaj ? ' · scores concours : <code>resultats.json</code> (' + escapeHtml(resultatsMaj) + ')' : ''}. Les points officiels viennent de l’organisateur.</p>`;
  }

  function renderOffSeason(root) {
    root.innerHTML = `
      <div class="live-scores-head">
        <h2 class="live-scores-title">⚽ CDM 2026</h2>
      </div>
      ${renderFifaCta()}
      <p class="live-scores-msg">Calendrier et scores pendant la CDM (juin–juillet 2026).</p>`;
  }

  async function refresh(root) {
    if (!root) return;
    root.classList.add('loading');
    try {
      const data = await fetchTodayMatches();
      renderWidget(root, data);
    } catch (e) {
      root.innerHTML = `
        <div class="live-scores-head"><h2 class="live-scores-title">⚽ CDM 2026</h2></div>
        ${renderFifaCta()}
        <p class="live-scores-msg">Calendrier indisponible (${escapeHtml(e.message)}).</p>
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

  global.CDM_LIVE_SCORES = {
    mount,
    refresh,
    getStoredEmail: () => {
      try { return localStorage.getItem(LS_EMAIL_KEY) || ''; } catch (e) { return ''; }
    },
  };
})(window);
