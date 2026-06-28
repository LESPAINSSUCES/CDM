/**
 * Forme récente (V/N/D) depuis les résultats officiels publiés (resultats.json).
 */
(function (global) {
  const MAX_FORM = 3;

  function normTeam(s) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ');
  }

  function parseScore(v) {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function readPouleMatch(num, official) {
    const m = official?.matchs?.['Match ' + num];
    if (!m?.home || !m?.away) return null;
    const hh = parseScore(m.scoreHome);
    const aa = parseScore(m.scoreAway);
    if (hh == null || aa == null) return null;
    return { num, home: m.home, away: m.away, hh, aa };
  }

  function readKoMatch(num, official) {
    const key = 'Match ' + num;
    const m = official?.scoresElimination?.[key] || official?.scoresElimination?.[String(num)];
    if (!m) return null;
    let home = m.home || '';
    let away = m.away || '';
    if (!home || !away) {
      const pair = official?.matchsEliminationOfficiels?.[String(num)];
      if (pair?.home) home = pair.home;
      if (pair?.away) away = pair.away;
    }
    if (!home || !away) return null;
    const hh = parseScore(m.scoreHome);
    const aa = parseScore(m.scoreAway);
    if (hh == null || aa == null) return null;
    return { num, home, away, hh, aa };
  }

  function letterForTeam(row, team) {
    const nt = normTeam(team);
    if (row.hh === row.aa) return 'N';
    const win = row.hh > row.aa ? row.home : row.away;
    return normTeam(win) === nt ? 'V' : 'D';
  }

  function buildFormMap(official) {
    const map = {};
    const add = (team, letter) => {
      const k = normTeam(team);
      if (!k) return;
      if (!map[k]) map[k] = { label: team, letters: [] };
      map[k].letters.push(letter);
    };

    for (let num = 1; num <= 72; num++) {
      const row = readPouleMatch(num, official);
      if (!row) continue;
      add(row.home, letterForTeam(row, row.home));
      add(row.away, letterForTeam(row, row.away));
    }
    for (let num = 73; num <= 104; num++) {
      const row = readKoMatch(num, official);
      if (!row) continue;
      add(row.home, letterForTeam(row, row.home));
      add(row.away, letterForTeam(row, row.away));
    }
    return map;
  }

  function getFormLetters(team, official, beforeMatchNum, maxLen) {
    if (!team || !official) return [];
    const map = buildFormMap(official);
    const entry = map[normTeam(team)];
    if (!entry?.letters?.length) return [];

    if (!Number.isFinite(beforeMatchNum)) {
      return entry.letters.slice(-maxLen);
    }

    const prior = [];
    for (let num = 1; num <= 72; num++) {
      if (num >= beforeMatchNum) break;
      const row = readPouleMatch(num, official);
      if (!row) continue;
      if (normTeam(row.home) === normTeam(team) || normTeam(row.away) === normTeam(team)) {
        prior.push(letterForTeam(row, team));
      }
    }
    for (let num = 73; num <= 104; num++) {
      if (num >= beforeMatchNum) break;
      const row = readKoMatch(num, official);
      if (!row) continue;
      if (normTeam(row.home) === normTeam(team) || normTeam(row.away) === normTeam(team)) {
        prior.push(letterForTeam(row, team));
      }
    }
    return prior.slice(-maxLen);
  }

  function formHtml(team, official, beforeMatchNum, maxLen) {
    const letters = getFormLetters(team, official, beforeMatchNum, maxLen ?? MAX_FORM);
    if (!letters.length) return '';
    const spans = letters.map((l) => `<span class="team-form-${l}" title="${l === 'V' ? 'Victoire' : l === 'N' ? 'Nul' : 'Défaite'}">${l}</span>`).join('');
    return `<span class="team-form-line" title="Forme CDM (officiel, ${letters.length} dernier(s))">${spans}</span>`;
  }

  global.CDM_TEAM_FORM = {
    MAX_FORM,
    normTeam,
    getFormLetters,
    formHtml,
    buildFormMap,
  };
})(window);
