#!/usr/bin/env node
/**
 * Met à jour cursor-agent.json : tableau dérivé des pronos poules (inchangés)
 * + scores seizièmes sur affiches officielles M73–M88 (sans copier le réel).
 */
const fs = require('fs');
const path = require('path');
const { deriveTableau, applyOfficialKoFixtures, loadOfficialResultats } = require('./derive_tableau_from_poules.js');

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'data', 'seeds', 'cursor-agent.json');
const EXPORT = path.join(ROOT, 'data', 'grilles', 'CDM2026_Cursor_Agent.json');

function main() {
  const grille = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const official = loadOfficialResultats(ROOT);

  deriveTableau(grille, {
    scoresOnlyR32: false,
    favoredTeam: 'Argentine',
    finalWinner: 'Argentine',
    finalists: ['Argentine', 'Espagne'],
  });

  applyOfficialKoFixtures(grille, official);

  const seizieme = {};
  for (let m = 73; m <= 88; m++) {
    const pair = official.matchsEliminationOfficiels?.[String(m)];
    if (pair?.home && pair?.away) {
      seizieme['M' + m] = { left: pair.home, right: pair.away };
    }
  }
  grille.seiziemeParMatchR32 = seizieme;

  delete grille._deriveMeta;

  const json = JSON.stringify(grille, null, 2) + '\n';
  fs.writeFileSync(SEED, json, 'utf8');
  fs.writeFileSync(EXPORT, json, 'utf8');

  console.log('OK', SEED);
  console.log('OK', EXPORT);
  console.log('Poules:', Object.keys(grille.matchs).length, 'matchs (pronos agent inchangés)');
  console.log('Tableau vainqueur:', grille.etape2Tableau?.winner);
  console.log('KO M73–M88:', Object.keys(grille.scoresElimination).filter((k) => {
    const n = parseInt(k.replace(/\D/g, ''), 10);
    return n >= 73 && n <= 88;
  }).length, 'scores sur affiches officielles');
  console.log('Ex M79:', grille.scoresElimination['Match 79']);
}

main();
