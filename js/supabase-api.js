/** Helpers Supabase REST (sans SDK). */
(function () {
  function cfg() {
    return window.CDM_CONFIG || {};
  }

  function isConfigured() {
    const c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }

  function headers(extra) {
    const c = cfg();
    return Object.assign({
      apikey: c.supabaseAnonKey,
      Authorization: 'Bearer ' + c.supabaseAnonKey,
      'Content-Type': 'application/json',
    }, extra || {});
  }

  function baseUrl() {
    return cfg().supabaseUrl.replace(/\/$/, '');
  }

  function currentLeague() {
    try {
      return (window.CDM_LEAGUE && window.CDM_LEAGUE.current()) || 'pains-suces';
    } catch (e) {
      return 'pains-suces';
    }
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function rpc(name, body) {
    const res = await fetch(baseUrl() + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || data.details || ('Supabase RPC ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  const GRILLE_SELECT = 'email,prenom,nom,equipe,payload,updated_at,league_id';

  function rowToParticipant(row) {
    return rowToFullGrille(row);
  }

  function rowToFullGrille(row) {
    const p = row.payload || {};
    return {
      ...p,
      identite: {
        prenom: row.prenom || p.identite?.prenom || '',
        nom: row.nom || p.identite?.nom || '',
        email: row.email || p.identite?.email || '',
        equipe: row.equipe || p.identite?.equipe || '',
      },
      matchs: p.matchs || {},
      equipesQualifiees32Liste: p.equipesQualifiees32Liste || [],
      etape2Tableau: p.etape2Tableau || p.etape2 || {},
      etape2Pick: p.etape2Pick || {},
      vainqueursTableauEliminationChoisis: p.vainqueursTableauEliminationChoisis || {},
      phaseFinalePourBareme: p.phaseFinalePourBareme || {},
      scoresElimination: p.scoresElimination || {},
      bonus: p.bonus || {},
      sourceFichier: p.sourceExcel || p.sourceFichier || 'supabase',
      updatedAt: row.updated_at || null,
    };
  }

  async function fetchGrilleAuthInfo(email) {
    if (!isConfigured()) return { exists: false, hasCode: false };
    const em = String(email || '').trim().toLowerCase();
    if (!em) return { exists: false, hasCode: false };
    try {
      const data = await rpc('grille_auth_info', { p_email: em, p_league_id: currentLeague() });
      return {
        exists: !!data.exists,
        hasCode: !!data.hasCode,
      };
    } catch (e) {
      console.warn('grille_auth_info:', e);
      return { exists: false, hasCode: false };
    }
  }

  async function verifyPlayerCodeHash(email, codeHash) {
    if (!isConfigured() || !codeHash) return false;
    const em = String(email || '').trim().toLowerCase();
    if (!em) return false;
    try {
      return !!await rpc('verify_player_code', { p_email: em, p_code_hash: codeHash, p_league_id: currentLeague() });
    } catch (e) {
      return false;
    }
  }

  async function verifyPlayerCode(email, codePlain) {
    if (!codePlain) return false;
    return verifyPlayerCodeHash(email, await sha256(String(codePlain)));
  }

  async function setPlayerCodeIfEmpty(email, codePlain) {
    if (!isConfigured()) throw new Error('Supabase non configuré (js/config.js).');
    const em = String(email || '').trim().toLowerCase();
    if (!em) throw new Error('E-mail obligatoire.');
    const codeHash = await sha256(String(codePlain));
    return rpc('set_player_code_if_empty', { p_email: em, p_code_hash: codeHash, p_league_id: currentLeague() });
  }

  async function changePlayerCode(email, oldCodePlain, newCodePlain) {
    if (!isConfigured()) throw new Error('Supabase non configuré (js/config.js).');
    const em = String(email || '').trim().toLowerCase();
    if (!em) throw new Error('E-mail obligatoire.');
    if (!oldCodePlain || !newCodePlain) throw new Error('Ancien et nouveau code requis.');
    try {
      return await rpc('change_player_code', {
        p_email: em,
        p_auth_code_hash: await sha256(String(oldCodePlain)),
        p_new_code_hash: await sha256(String(newCodePlain)),
        p_league_id: currentLeague(),
      });
    } catch (e) {
      if (/function.*does not exist/i.test(e.message || '')) {
        throw new Error('Migration change_player_code requise — exécutez scripts/supabase_change_player_code.sql.');
      }
      throw e;
    }
  }

  async function adminGrillesRequest(action, email, pinHash, league) {
    if (!isConfigured()) throw new Error('Supabase non configuré (js/config.js).');
    const em = String(email || '').trim().toLowerCase();
    if (!em) throw new Error('E-mail obligatoire.');
    if (!pinHash) throw new Error('Session organisateur requise.');

    const url = adminGrillesUrl();
    const c = cfg();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: c.supabaseAnonKey,
        Authorization: 'Bearer ' + c.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, email: em, pinHash, league: league || currentLeague() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || ('Supabase ' + res.status));
    }
    return data;
  }

  async function fetchGrilleByEmail(email) {
    if (!isConfigured()) return null;
    const em = String(email || '').trim().toLowerCase();
    if (!em) return null;
    const url = baseUrl()
      + '/rest/v1/grilles?email=eq.' + encodeURIComponent(em)
      + '&league_id=eq.' + encodeURIComponent(currentLeague())
      + '&select=' + encodeURIComponent(GRILLE_SELECT)
      + '&limit=1';
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || ('Supabase ' + res.status));
    }
    const rows = await res.json();
    return rows.length ? rowToFullGrille(rows[0]) : null;
  }

  async function fetchAllGrilles(opts) {
    if (!isConfigured()) return [];
    const options = opts || {};
    const leagueFilter = options.allLeagues
      ? ''
      : '&league_id=eq.' + encodeURIComponent(options.league || currentLeague());
    const url = baseUrl()
      + '/rest/v1/grilles?select=' + encodeURIComponent(GRILLE_SELECT)
      + leagueFilter
      + '&order=updated_at.desc';
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || ('Supabase ' + res.status));
    }
    return res.json();
  }

  async function upsertGrille(data, opts) {
    if (!isConfigured()) throw new Error('Supabase non configuré (js/config.js).');
    const email = (data.identite?.email || '').trim().toLowerCase();
    if (!email) throw new Error('E-mail obligatoire.');
    if (!(data.identite?.prenom || '').trim()) throw new Error('Prénom obligatoire.');
    if (!(data.identite?.nom || '').trim()) throw new Error('Nom obligatoire.');

    const options = opts || {};
    let authCodeHash = options.authCodeHash || null;
    let newCodeHash = options.newCodeHash || null;

    if (options.codePlain && !newCodeHash) {
      newCodeHash = await sha256(String(options.codePlain));
    }
    if (options.authCodePlain && !authCodeHash) {
      authCodeHash = await sha256(String(options.authCodePlain));
    }

    try {
      return await rpc('upsert_grille_player', {
        p_email: email,
        p_prenom: data.identite.prenom.trim(),
        p_nom: data.identite.nom.trim(),
        p_equipe: (data.identite.equipe || '').trim(),
        p_payload: data,
        p_new_code_hash: newCodeHash || null,
        p_auth_code_hash: authCodeHash || null,
        p_league_id: options.league || currentLeague(),
      });
    } catch (e) {
      if (/function.*does not exist/i.test(e.message || '')) {
        throw new Error('Migration code joueur requise — exécutez scripts/supabase_player_code.sql dans Supabase.');
      }
      throw e;
    }
  }

  async function loadParticipantsMerged(loadJsonFn) {
    const byKey = new Map();

    function addParticipant(p) {
      const id = p.identite || {};
      const email = (id.email || '').trim().toLowerCase();
      const key = email || ((id.prenom || '') + '_' + (id.nom || '')).trim().toLowerCase();
      if (!key) return;
      byKey.set(key, p);
    }

    if (isConfigured()) {
      try {
        const rows = await fetchAllGrilles();
        rows.forEach(r => addParticipant(rowToParticipant(r)));
      } catch (e) {
        console.warn('Supabase:', e);
      }
    }

    // Le fichier statique participants.json n'a pas de ligue : on ne le fusionne
    // que pour la ligue historique (pains-suces) afin de ne pas polluer les autres.
    if (currentLeague() === 'pains-suces') {
      try {
        const fileData = await loadJsonFn('data/participants.json');
        (fileData.participants || []).forEach(p => {
          const email = ((p.identite || {}).email || '').trim().toLowerCase();
          const key = email || ((p.identite?.prenom || '') + '_' + (p.identite?.nom || '')).trim().toLowerCase();
          if (key && !byKey.has(key)) addParticipant(p);
        });
      } catch (e) {
        /* fichier local optionnel */
      }
    }

    return [...byKey.values()];
  }

  function adminGrillesUrl() {
    const c = cfg();
    if (c.adminGrillesUrl) return c.adminGrillesUrl;
    if (!c.supabaseUrl) return '';
    return baseUrl() + '/functions/v1/admin-grilles';
  }

  async function deleteGrilleByEmail(email, pinHash, league) {
    return adminGrillesRequest('delete', email, pinHash, league);
  }

  async function resetPlayerCodeByEmail(email, pinHash, league) {
    return adminGrillesRequest('reset_code', email, pinHash, league);
  }

  window.CDM_SUPABASE = {
    isConfigured,
    sha256,
    upsertGrille,
    fetchAllGrilles,
    fetchGrilleByEmail,
    fetchGrilleAuthInfo,
    verifyPlayerCode,
    verifyPlayerCodeHash,
    setPlayerCodeIfEmpty,
    changePlayerCode,
    deleteGrilleByEmail,
    resetPlayerCodeByEmail,
    loadParticipantsMerged,
    rowToParticipant,
    rowToFullGrille,
  };
})();
