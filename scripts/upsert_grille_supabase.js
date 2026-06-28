#!/usr/bin/env node
/** Pousse une grille JSON vers Supabase (RPC upsert_grille_player). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qpkiwausbvedzmovfvxe.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2l3YXVzYnZlZHptb3ZmdnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDY2MDksImV4cCI6MjA5NDg4MjYwOX0.cX8cSXlXMH4jAa1EP72trk-dDypTj9a0yZtAEQqJ-0c';

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

async function upsertGrille(data, { codePlain = '1234', league = 'pains-suces' } = {}) {
  const email = (data.identite?.email || '').trim().toLowerCase();
  const codeHash = sha256(codePlain);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_grille_player`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_email: email,
      p_prenom: data.identite.prenom.trim(),
      p_nom: data.identite.nom.trim(),
      p_equipe: (data.identite.equipe || '').trim(),
      p_payload: data,
      p_new_code_hash: codeHash,
      p_auth_code_hash: codeHash,
      p_league_id: league,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || JSON.stringify(body));
  return body;
}

async function main() {
  const file = process.argv[2] || 'data/seeds/cursor-agent.json';
  const league = process.argv[3] || 'pains-suces';
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const result = await upsertGrille(data, { league });
  console.log('Upsert OK', data.identite.email, league, result);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
