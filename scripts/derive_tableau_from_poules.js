#!/usr/bin/env node
/**
 * Dérive etape2Tableau + scores seizièmes (M73–M88) depuis les pronos poules.
 * Usage: node scripts/derive_tableau_from_poules.js [fichier.json] [--scores-only-r32]
 */
const fs = require('fs');
const path = require('path');

const GROUPS = {
  'Groupe A': [[1, 'Mexique', 'Afrique du Sud'], [2, 'Corée du Sud', 'Rép. Tchèque'], [25, 'Rép. Tchèque', 'Afrique du Sud'], [28, 'Mexique', 'Corée du Sud'], [53, 'Rép. Tchèque', 'Mexique'], [54, 'Afrique du Sud', 'Corée du Sud']],
  'Groupe B': [[3, 'Canada', 'Bosnie Herzégovine'], [5, 'Qatar', 'Suisse'], [26, 'Suisse', 'Bosnie Herzégovine'], [27, 'Canada', 'Qatar'], [49, 'Suisse', 'Canada'], [50, 'Bosnie Herzégovine', 'Qatar']],
  'Groupe C': [[6, 'Brésil', 'Maroc'], [7, 'Haïti', 'Écosse'], [30, 'Écosse', 'Maroc'], [31, 'Brésil', 'Haïti'], [51, 'Écosse', 'Brésil'], [52, 'Maroc', 'Haïti']],
  'Groupe D': [[4, 'États-Unis', 'Paraguay'], [8, 'Australie', 'Turquie'], [32, 'Turquie', 'Paraguay'], [29, 'États-Unis', 'Australie'], [59, 'Turquie', 'États-Unis'], [60, 'Paraguay', 'Australie']],
  'Groupe E': [[9, 'Allemagne', 'Curacao'], [11, "Côte d'Ivoire", 'Équateur'], [35, 'Équateur', 'Curacao'], [34, 'Allemagne', "Côte d'Ivoire"], [55, 'Équateur', 'Allemagne'], [56, 'Curacao', "Côte d'Ivoire"]],
  'Groupe F': [[10, 'Pays-Bas', 'Japon'], [12, 'Suède', 'Tunisie'], [36, 'Tunisie', 'Japon'], [33, 'Pays-Bas', 'Suède'], [57, 'Tunisie', 'Pays-Bas'], [58, 'Japon', 'Suède']],
  'Groupe G': [[14, 'Belgique', 'Égypte'], [16, 'Iran', 'Nouvelle Zélande'], [40, 'Nouvelle Zélande', 'Égypte'], [38, 'Belgique', 'Iran'], [65, 'Nouvelle Zélande', 'Belgique'], [66, 'Égypte', 'Iran']],
  'Groupe H': [[13, 'Espagne', 'Cap Vert'], [15, 'Arabie Saoudite', 'Uruguay'], [39, 'Uruguay', 'Cap Vert'], [37, 'Espagne', 'Arabie Saoudite'], [63, 'Uruguay', 'Espagne'], [64, 'Cap Vert', 'Arabie Saoudite']],
  'Groupe I': [[17, 'France', 'Sénégal'], [18, 'Irak', 'Norvège'], [43, 'Norvège', 'Sénégal'], [42, 'France', 'Irak'], [61, 'Norvège', 'France'], [62, 'Sénégal', 'Irak']],
  'Groupe J': [[19, 'Argentine', 'Algérie'], [20, 'Autriche', 'Jordanie'], [44, 'Jordanie', 'Algérie'], [41, 'Argentine', 'Autriche'], [71, 'Jordanie', 'Argentine'], [72, 'Algérie', 'Autriche']],
  'Groupe K': [[21, 'Portugal', 'RD Congo'], [24, 'Ouzbékistan', 'Colombie'], [48, 'Colombie', 'RD Congo'], [45, 'Portugal', 'Ouzbékistan'], [69, 'Colombie', 'Portugal'], [70, 'RD Congo', 'Ouzbékistan']],
  'Groupe L': [[22, 'Angleterre', 'Croatie'], [23, 'Ghana', 'Panama'], [47, 'Panama', 'Croatie'], [46, 'Angleterre', 'Ghana'], [67, 'Panama', 'Angleterre'], [68, 'Croatie', 'Ghana']],
};

const KNOCK_R32_DEF = [
  { m: 73, L: { k: 'runner', g: 'A' }, R: { k: 'runner', g: 'B' } },
  { m: 76, L: { k: 'winner', g: 'C' }, R: { k: 'runner', g: 'F' } },
  { m: 74, L: { k: 'winner', g: 'E' }, R: { k: 'third', pool: ['A', 'B', 'C', 'D', 'F'] } },
  { m: 75, L: { k: 'winner', g: 'F' }, R: { k: 'runner', g: 'C' } },
  { m: 78, L: { k: 'runner', g: 'E' }, R: { k: 'runner', g: 'I' } },
  { m: 77, L: { k: 'winner', g: 'I' }, R: { k: 'third', pool: ['C', 'D', 'F', 'G', 'H'] } },
  { m: 79, L: { k: 'winner', g: 'A' }, R: { k: 'third', pool: ['C', 'E', 'F', 'H', 'I'] } },
  { m: 80, L: { k: 'winner', g: 'L' }, R: { k: 'third', pool: ['E', 'H', 'I', 'J', 'K'] } },
  { m: 82, L: { k: 'winner', g: 'G' }, R: { k: 'third', pool: ['A', 'E', 'H', 'I', 'J'] } },
  { m: 81, L: { k: 'winner', g: 'D' }, R: { k: 'third', pool: ['B', 'E', 'F', 'I', 'J'] } },
  { m: 84, L: { k: 'winner', g: 'H' }, R: { k: 'runner', g: 'J' } },
  { m: 83, L: { k: 'runner', g: 'K' }, R: { k: 'runner', g: 'L' } },
  { m: 85, L: { k: 'winner', g: 'B' }, R: { k: 'third', pool: ['E', 'F', 'G', 'I', 'J'] } },
  { m: 88, L: { k: 'runner', g: 'D' }, R: { k: 'runner', g: 'G' } },
  { m: 86, L: { k: 'winner', g: 'J' }, R: { k: 'runner', g: 'H' } },
  { m: 87, L: { k: 'winner', g: 'K' }, R: { k: 'third', pool: ['D', 'E', 'I', 'J', 'L'] } },
];

const KO_R16 = { 89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80], 93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87] };
const KO_QF = { 97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96] };
const KO_SF = { 101: [97, 98], 102: [99, 100] };

function parseScore(v) {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function groupLetter(title) {
  return title.replace(/^Groupe\s+/i, '').trim().slice(-1).toUpperCase();
}

function buildEngine(matchs) {
  function getGoals(num) {
    const m = matchs['Match ' + num] || {};
    return [parseScore(m.scoreHome), parseScore(m.scoreAway)];
  }

  const STANDINGS = {};
  const THIRDS_ALL = [];
  for (const [title, rows] of Object.entries(GROUPS)) {
    const uniq = {};
    rows.forEach(([, hm, aw]) => { uniq[hm] = 1; uniq[aw] = 1; });
    const teams = Object.keys(uniq);
    const pts = {}, gf = {}, ga = {}, pl = {};
    teams.forEach((t) => { pts[t] = gf[t] = ga[t] = pl[t] = 0; });
    let played = 0;
    for (const [num, hm, aw] of rows) {
      const [hh, aa] = getGoals(num);
      if (!Number.isFinite(hh) || !Number.isFinite(aa)) return null;
      played++;
      pl[hm]++; pl[aw]++;
      gf[hm] += hh; ga[hm] += aa;
      gf[aw] += aa; ga[aw] += hh;
      if (hh > aa) pts[hm] += 3;
      else if (aa > hh) pts[aw] += 3;
      else { pts[hm]++; pts[aw]++; }
    }
    if (played !== rows.length) return null;
    const ord = [...teams].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a];
      const gda = gf[a] - ga[a], gdb = gf[b] - ga[b];
      if (gdb !== gda) return gdb - gda;
      if (gf[b] !== gf[a]) return gf[b] - gf[a];
      return a.localeCompare(b, 'fr');
    }).map((t, i) => ({ rang: i + 1, team: t, pts: pts[t], diff: gf[t] - ga[t], bp: gf[t] }));
    STANDINGS[groupLetter(title)] = { letter: groupLetter(title), teams: ord };
    THIRDS_ALL.push({ grp: groupLetter(title), team: ord[2].team, pts: ord[2].pts, diff: ord[2].diff, bp: ord[2].bp });
  }

  THIRDS_ALL.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.bp !== a.bp) return b.bp - a.bp;
    return a.grp.localeCompare(b.grp);
  });
  const ADVANCE_THIRD = new Set(THIRDS_ALL.slice(0, 8).map((r) => r.grp));
  const THIRD_RANK_IDX = {};
  THIRDS_ALL.forEach((r, idx) => { THIRD_RANK_IDX[r.grp] = idx; });

  function resolveStraight(slot) {
    const tb = STANDINGS[slot.g];
    if (!tb) return '';
    return slot.k === 'winner' ? tb.teams[0].team : tb.teams[1].team;
  }
  function assignStraightSlot(slot, used) {
    const t = resolveStraight(slot);
    if (!t || used.has(t)) return '';
    used.add(t);
    return t;
  }
  function getThirdCandidates(pool, used) {
    const candidates = [];
    for (const L of pool || []) {
      const up = String(L).toUpperCase();
      if (!ADVANCE_THIRD.has(up)) continue;
      const rk = THIRD_RANK_IDX[up];
      const g = STANDINGS[up];
      const tn = g?.teams[2]?.team;
      if (tn != null && rk != null && !used.has(tn)) candidates.push({ team: tn, rk });
    }
    candidates.sort((a, b) => a.rk - b.rk);
    return candidates;
  }
  function backtrackThirds(slots, idx, used, out) {
    if (idx >= slots.length) return true;
    for (const c of getThirdCandidates(slots[idx].pool, used)) {
      used.add(c.team);
      out.push({ m: slots[idx].m, side: slots[idx].side, team: c.team });
      if (backtrackThirds(slots, idx + 1, used, out)) return true;
      used.delete(c.team);
      out.pop();
    }
    return false;
  }

  const R32_SIDE = {};
  const used = new Set();
  const thirdSlots = [];
  KNOCK_R32_DEF.forEach((def) => {
    R32_SIDE[def.m] = { left: '', right: '' };
    if (def.L.k === 'third') thirdSlots.push({ m: def.m, side: 'left', pool: def.L.pool });
    else R32_SIDE[def.m].left = assignStraightSlot(def.L, used);
    if (def.R.k === 'third') thirdSlots.push({ m: def.m, side: 'right', pool: def.R.pool });
    else R32_SIDE[def.m].right = assignStraightSlot(def.R, used);
  });
  const thirdOut = [];
  if (backtrackThirds(thirdSlots, 0, used, thirdOut)) {
    thirdOut.forEach((a) => { R32_SIDE[a.m][a.side] = a.team; });
  } else {
    thirdSlots.forEach((slot) => {
      if (R32_SIDE[slot.m][slot.side]) return;
      const c = getThirdCandidates(slot.pool, used)[0];
      if (c) { used.add(c.team); R32_SIDE[slot.m][slot.side] = c.team; }
    });
  }

  const r32 = [];
  Object.values(R32_SIDE).forEach((p) => {
    if (p.left) r32.push(p.left);
    if (p.right) r32.push(p.right);
  });
  return { R32_SIDE, r32 };
}

function bracketSides(mid, R32_SIDE, etape2Pick) {
  mid = Number(mid);
  if (mid >= 73 && mid <= 88) {
    const s = R32_SIDE[mid] || {};
    return [s.left || '', s.right || ''];
  }
  if (KO_R16[mid]) {
    const [a, b] = KO_R16[mid];
    return [etape2Pick[a] || '', etape2Pick[b] || ''];
  }
  if (KO_QF[mid]) {
    const [a, b] = KO_QF[mid];
    return [etape2Pick[a] || '', etape2Pick[b] || ''];
  }
  if (KO_SF[mid]) {
    const [a, b] = KO_SF[mid];
    return [etape2Pick[a] || '', etape2Pick[b] || ''];
  }
  if (mid === 104) return [etape2Pick[101] || '', etape2Pick[102] || ''];
  if (mid === 103) {
    const w101 = etape2Pick[101], w102 = etape2Pick[102];
    const [a101, b101] = bracketSides(101, R32_SIDE, etape2Pick);
    const [a102, b102] = bracketSides(102, R32_SIDE, etape2Pick);
    const l101 = w101 && a101 && b101 ? (w101 === a101 ? b101 : a101) : '';
    const l102 = w102 && a102 && b102 ? (w102 === a102 ? b102 : a102) : '';
    return [l101, l102];
  }
  return ['', ''];
}

function pickWinner(home, away, favoredTeam) {
  if (!home || !away) return '';
  if (favoredTeam && (home === favoredTeam || away === favoredTeam)) return favoredTeam;
  return home;
}

function scoreForWinner(home, away, winner) {
  if (winner === home) return { home, away, scoreHome: '2', scoreAway: '1', vainqueur: winner };
  return { home, away, scoreHome: '1', scoreAway: '2', vainqueur: winner };
}

function deriveTableau(grille, opts = {}) {
  const favored = opts.favoredTeam || grille._deriveMeta?.favoredTeam || 'Argentine';
  const scoresOnlyR32 = opts.scoresOnlyR32 !== false;
  const finalWinner = opts.finalWinner || favored;
  const finalists = opts.finalists || [favored, 'Espagne'];

  const eng = buildEngine(grille.matchs || {});
  if (!eng) throw new Error('72 matchs poules incomplets');

  const { R32_SIDE, r32 } = eng;
  const etape2Pick = {};
  const vainqueurs = {};

  for (let m = 73; m <= 102; m++) {
    const [home, away] = bracketSides(m, R32_SIDE, etape2Pick);
    const w = pickWinner(home, away, favored);
    if (w) {
      etape2Pick[m] = w;
      vainqueurs[String(m)] = w;
    }
  }
  const [h103a, h103b] = bracketSides(103, R32_SIDE, etape2Pick);
  if (h103a && h103b) {
    const w103 = pickWinner(h103a, h103b, favored);
    etape2Pick[103] = w103;
    vainqueurs['103'] = w103;
  }
  const [h104a, h104b] = bracketSides(104, R32_SIDE, etape2Pick);
  if (h104a && h104b) {
    const w104 = pickWinner(h104a, h104b, favored);
    etape2Pick[104] = w104;
    vainqueurs['104'] = w104;
  }

  const syncFromPick = () => {
    const r16 = KNOCK_R32_DEF.map((d) => etape2Pick[d.m]).filter(Boolean);
    const qf = Object.keys(KO_R16).map(Number).sort((a, b) => a - b).map((m) => etape2Pick[m]).filter(Boolean);
    const sf = Object.keys(KO_QF).map(Number).sort((a, b) => a - b).map((m) => etape2Pick[m]).filter(Boolean);
    const finalists = [etape2Pick[101], etape2Pick[102]].filter(Boolean);
    grille.etape2Tableau = {
      r32: [...r32],
      r16,
      qf,
      sf,
      finalists,
      winner: etape2Pick[104] || finalWinner,
    };
    grille.equipesQualifiees32Liste = [...r32];
    grille.etape2Pick = Object.fromEntries(Object.entries(etape2Pick).map(([k, v]) => [String(k), v]));
    grille.vainqueursTableauEliminationChoisis = { ...vainqueurs };
    grille.phaseFinalePourBareme = {
      liste32QualifiesIssuesPoules: [...r32],
      vainqueursSeiziemePourHuitiemes16: grille.etape2Tableau.r16,
      vainqueursHuitiemesPourQuarts8: grille.etape2Tableau.qf,
      vainqueursQuartsPourDemis4: grille.etape2Tableau.sf,
      finalistesChoisis: finalists,
      troisiemePlaceChoix: etape2Pick[103] || '',
      vainqueurFinal: etape2Pick[104] || finalWinner,
    };

    const scores = {};
    const maxM = scoresOnlyR32 ? 88 : 104;
    for (let m = 73; m <= maxM; m++) {
      const [home, away] = bracketSides(m, R32_SIDE, etape2Pick);
      const w = etape2Pick[m];
      if (!home || !away || !w) continue;
      const sc = scoreForWinner(home, away, w);
      scores['Match ' + m] = sc;
    }
    grille.scoresElimination = scores;
  };

  syncFromPick();
  return { r32Len: r32.length, r32, etape2Pick, R32_SIDE };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) || 'data/seeds/cursor-agent.json';
  const scoresOnlyR32 = !args.includes('--all-ko-scores');
  const abs = path.resolve(file);
  const grille = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const out = deriveTableau(grille, { scoresOnlyR32, favoredTeam: 'Argentine', finalWinner: 'Argentine', finalists: ['Argentine', 'Espagne'] });
  fs.writeFileSync(abs, JSON.stringify(grille, null, 2) + '\n', 'utf8');
  console.log('OK', abs);
  console.log('r32:', out.r32Len, 'teams');
  console.log('M73:', out.R32_SIDE[73]);
  console.log('M77:', out.R32_SIDE[77]);
  console.log('scoresElimination:', Object.keys(grille.scoresElimination).length, 'matchs');
}

if (require.main === module) {
  main();
}

module.exports = { deriveTableau, buildEngine, GROUPS, KNOCK_R32_DEF };
