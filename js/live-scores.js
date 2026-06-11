/**
 * Scores CDM (info seulement — n’alimente pas le barème).
 * Source live : worldcup26.ir via proxy Supabase (CORS) + lien FIFA + resultats.json (organisateur).
 */
(function (global) {
  const FIFA_SCORES_URL = 'https://www.fifa.com/fr/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=FR&wtw-filter=ALL';
  const WC2026_API = 'https://worldcup26.ir/get/games';
  const REFRESH_MS = 2 * 60 * 1000;
  const CDM_WINDOW_START = new Date('2026-06-01T00:00:00');
  const CDM_WINDOW_END = new Date('2026-07-31T23:59:59');
  const LS_EMAIL_KEY = 'cdm2026_email';

  const EN_TO_FR = {
    'Mexico': 'Mexique',
    'South Africa': 'Afrique du Sud',
    'South Korea': 'Corée du Sud',
    'Czech Republic': 'Rép. Tchèque',
    'Canada': 'Canada',
    'Bosnia and Herzegovina': 'Bosnie Herzégovine',
    'Qatar': 'Qatar',
    'Switzerland': 'Suisse',
    'Brazil': 'Brésil',
    'Morocco': 'Maroc',
    'Haiti': 'Haïti',
    'Scotland': 'Écosse',
    'United States': 'États-Unis',
    'Paraguay': 'Paraguay',
    'Australia': 'Australie',
    'Turkey': 'Turquie',
    'Germany': 'Allemagne',
    'Curaçao': 'Curacao',
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
    'Democratic Republic of the Congo': 'RD Congo',
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
    if (!name || /^(Runner-up|Winner|3rd|Loser)\b/i.test(name)) return name;
    return EN_TO_FR[name] || name;
  }

  function normTeam(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
  }

  function getProxyUrl() {
    const cfg = global.CDM_CONFIG || {};
    if (cfg.liveScoresUrl) return cfg.liveScoresUrl;
    if (cfg.supabaseUrl) return cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/live-scores';
    return '';
  }

  function statusLabel(f) {
    const st = f.status || {};
    const short = st.short || '';
    if (short === 'LIVE' || short === '1H' || short === '2H' || short === 'HT' || short === 'ET' || short === 'P') {
      return { text: st.elapsed != null ? st.elapsed + '′' : 'En cours', live: true };
    }
    if (short === 'FT' || short === 'AET' || short === 'PEN') return { text: 'Terminé', live: false };
    if (st.long) return { text: st.long, live: false };
    const d = f.fixture?.date ? new Date(f.fixture.date) : null;
    if (d) {
      return {
        text: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        live: false,
      };
    }
    return { text: '—', live: false };
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
        return { home: sh, away: sa };
      }
    }
    return null;
  }

  function normalizeFromProxy(data) {
    return (data?.fixtures || []).map((f) => {
      const home = teamLabel(f.teams?.home?.name);
      const away = teamLabel(f.teams?.away?.name);
      return { raw: f, home, away };
    });
  }

  function normalizeFromWc26(data) {
    const todayParis = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    const games = data?.games || [];
    return games
      .filter((g) => {
        const live = String(g.time_elapsed || '').toLowerCase() === 'live';
        const key = (g.local_date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        const dateKey = key ? `${key[3]}-${key[1]}-${key[2]}` : '';
        return live || dateKey === todayParis;
      })
      .map((g) => {
        const home = teamLabel(g.home_team_name_en || g.home_team_label);
        const away = teamLabel(g.away_team_name_en || g.away_team_label);
        const hs = parseInt(g.home_score, 10);
        const as = parseInt(g.away_score, 10);
        const live = String(g.time_elapsed || '').toLowerCase() === 'live';
        const finished = String(g.finished || '').toUpperCase() === 'TRUE';
        const raw = {
          teams: { home: { name: g.home_team_name_en || g.home_team_label }, away: { name: g.away_team_name_en || g.away_team_label } },
          goals: { home: Number.isNaN(hs) ? null : hs, away: Number.isNaN(as) ? null : as },
          status: {
            short: live ? 'LIVE' : (finished ? 'FT' : 'NS'),
            long: live ? 'En cours' : (finished ? 'Terminé' : (g.local_date || '').split(' ')[1] || 'À venir'),
          },
          group: g.group,
        };
        return { raw, home, away, scorers: g.home_scorers, group: g.group };
      });
  }

  async function fetchFixtures() {
    const proxyUrl = getProxyUrl();
    const resultats = await fetchResultats();

    if (proxyUrl) {
      try {
        const anon = global.CDM_CONFIG?.supabaseAnonKey || '';
        const headers = { Accept: 'application/json' };
        if (anon) headers.Authorization = 'Bearer ' + anon;
        const res = await fetch(proxyUrl + (proxyUrl.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.fixtures?.length || !data.error) {
            return {
              items: normalizeFromProxy(data),
              fetchedAt: data.fetchedAt || new Date().toISOString(),
              source: data.source || 'worldcup26.ir',
              resultatsMaj: resultats?.meta?.misAJour || '',
              resultats,
            };
          }
        }
      } catch (e) { /* fallback below */ }
    }

    const res = await fetch(WC2026_API + '?t=' + Date.now());
    if (!res.ok) throw new Error('API worldcup26 indisponible — redéployez live-scores sur Supabase');
    const data = await res.json();
    return {
      items: normalizeFromWc26(data),
      fetchedAt: new Date().toISOString(),
      source: 'worldcup26.ir',
      resultatsMaj: resultats?.meta?.misAJour || '',
      resultats,
    };
  }

  function renderWidget(root, payload) {
    const { items, fetchedAt, resultats } = payload;
    const updated = new Date(fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const rows = items.map(({ raw, home, away, group }) => {
      const org = findOrgScore(resultats, home, away);
      const gh = org ? org.home : raw.goals?.home;
      const ga = org ? org.away : raw.goals?.away;
      const hasScore = gh != null && ga != null && !(gh === 0 && ga === 0 && raw.status?.short === 'NS');
      const score = hasScore ? { home: gh, away: ga } : null;
      const st = statusLabel(raw);
      return { home, away, score, st, group: group || raw.group };
    });

    const hasLive = rows.some((r) => r.st.live);

    let body;
    if (!rows.length) {
      body = `<p class="live-scores-msg">Aucun match aujourd’hui.</p>`;
    } else {
      body = `<ul class="live-scores-list">${rows.map((r) => {
        const scoreTxt = r.score
          ? `${escapeHtml(String(r.score.home))} – ${escapeHtml(String(r.score.away))}`
          : 'vs';
        const badge = r.st.live ? 'En cours' : escapeHtml(r.st.text);
        const grp = r.group && r.group.length <= 2 ? `Grp ${escapeHtml(r.group)}` : '';
        return `<li class="live-scores-card${r.st.live ? ' is-live' : ''}">
          <div class="live-scores-card-top">
            <span class="live-badge"><span class="live-dot"></span> ${badge}</span>
            ${grp ? `<span class="live-group">${grp}</span>` : ''}
          </div>
          <div class="live-scores-board">
            <span class="live-team home">${escapeHtml(r.home)}</span>
            <span class="live-score">${scoreTxt}</span>
            <span class="live-team away">${escapeHtml(r.away)}</span>
          </div>
        </li>`;
      }).join('')}</ul>`;
    }

    root.className = 'live-scores-widget' + (hasLive ? ' has-live' : '');
    root.innerHTML = `
      <div class="live-scores-head">
        <div class="live-scores-head-main">
          <h2 class="live-scores-title">Scores live</h2>
          <span class="live-scores-updated">Màj ${escapeHtml(updated)}</span>
        </div>
        <a class="live-scores-fifa-link" href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">FIFA →</a>
      </div>
      ${body}`;
  }

  function renderOffSeason(root) {
    root.className = 'live-scores-widget';
    root.innerHTML = `
      <div class="live-scores-head">
        <div class="live-scores-head-main">
          <h2 class="live-scores-title">CDM 2026</h2>
        </div>
        <a class="live-scores-fifa-link" href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">FIFA →</a>
      </div>
      <p class="live-scores-msg">Scores live pendant la compétition.</p>`;
  }

  async function refresh(root) {
    if (!root) return;
    root.classList.add('loading');
    try {
      const payload = await fetchFixtures();
      renderWidget(root, payload);
    } catch (e) {
      root.className = 'live-scores-widget';
      root.innerHTML = `
        <div class="live-scores-head">
          <div class="live-scores-head-main"><h2 class="live-scores-title">Scores live</h2></div>
          <a class="live-scores-fifa-link" href="${FIFA_SCORES_URL}" target="_blank" rel="noopener">FIFA →</a>
        </div>
        <p class="live-scores-msg">${escapeHtml(e.message)}</p>`;
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
