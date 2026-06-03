-- CDM 2026 — Codes d'invitation par ligue (inscriptions fermées sans lien)
-- À exécuter dans Supabase SQL Editor APRÈS supabase_leagues.sql
-- Codes = js/leagues.js (invite) — modifier les deux si vous changez un code

create or replace function public.check_league_invite(p_league_id text, p_invite_code text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(trim(p_invite_code), '') = case coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces')
      when 'pains-suces' then 'painssuces26'
      when 'peuple' then 'peuple26'
      when 'compet1' then 'compet1-26'
      when 'compet2' then 'compet2-26'
      else ''
    end,
    false
  );
$$;

drop function if exists public.upsert_grille_player(text, text, text, text, jsonb, text, text, text);
create or replace function public.upsert_grille_player(
  p_email text,
  p_prenom text,
  p_nom text,
  p_equipe text,
  p_payload jsonb,
  p_new_code_hash text default null,
  p_auth_code_hash text default null,
  p_league_id text default 'pains-suces',
  p_invite_code text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_league text := coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces');
  v_existing record;
begin
  if v_email = '' then
    raise exception 'E-mail obligatoire.';
  end if;
  if trim(coalesce(p_prenom, '')) = '' or trim(coalesce(p_nom, '')) = '' then
    raise exception 'Prénom et nom obligatoires.';
  end if;

  select email, code_hash into v_existing from grilles where email = v_email and league_id = v_league;

  if not found then
    if not public.check_league_invite(v_league, p_invite_code) then
      raise exception 'Invitation requise pour cette ligue. Utilisez le lien reçu par l''organisateur.';
    end if;
    if p_new_code_hash is null or p_new_code_hash = '' then
      raise exception 'Code secret obligatoire pour la première inscription.';
    end if;
    insert into grilles (email, prenom, nom, equipe, payload, code_hash, league_id, updated_at)
    values (
      v_email,
      trim(p_prenom),
      trim(p_nom),
      coalesce(trim(p_equipe), ''),
      p_payload,
      p_new_code_hash,
      v_league,
      now()
    );
    return json_build_object('ok', true, 'created', true);
  end if;

  if v_existing.code_hash is null or v_existing.code_hash = '' then
    if p_new_code_hash is null or p_new_code_hash = '' then
      raise exception 'Définissez votre code secret avant d''envoyer.';
    end if;
    update grilles set
      prenom = trim(p_prenom),
      nom = trim(p_nom),
      equipe = coalesce(trim(p_equipe), ''),
      payload = p_payload,
      code_hash = p_new_code_hash,
      updated_at = now()
    where email = v_email and league_id = v_league;
    return json_build_object('ok', true, 'created', false);
  end if;

  if p_auth_code_hash is null or p_auth_code_hash <> v_existing.code_hash then
    raise exception 'Code secret incorrect ou session expirée.';
  end if;

  update grilles set
    prenom = trim(p_prenom),
    nom = trim(p_nom),
    equipe = coalesce(trim(p_equipe), ''),
    payload = p_payload,
    code_hash = coalesce(nullif(p_new_code_hash, ''), v_existing.code_hash),
    updated_at = now()
  where email = v_email and league_id = v_league;

  return json_build_object('ok', true, 'created', false);
end;
$$;

grant execute on function public.check_league_invite(text, text) to anon, authenticated;
grant execute on function public.upsert_grille_player(text, text, text, text, jsonb, text, text, text, text) to anon, authenticated;
