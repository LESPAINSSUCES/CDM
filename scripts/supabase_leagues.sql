-- CDM 2026 — Multi-ligues (league_id)
-- À exécuter dans Supabase SQL Editor APRÈS supabase_schema.sql et supabase_player_code.sql.
-- Sûr pour l'existant : toutes les grilles déjà en base passent en 'pains-suces'.

-- 1) Colonne league_id (défaut = pains-suces)
alter table public.grilles add column if not exists league_id text not null default 'pains-suces';
update public.grilles set league_id = 'pains-suces' where league_id is null or league_id = '';

-- 2) Unicité par (email, league_id) : un même e-mail peut jouer dans plusieurs ligues
alter table public.grilles drop constraint if exists grilles_email_unique;
alter table public.grilles add constraint grilles_email_league_unique unique (email, league_id);

create index if not exists grilles_league_idx on public.grilles (league_id, updated_at desc);

-- 3) RPCs recréées avec p_league_id (défaut 'pains-suces')
drop function if exists public.grille_auth_info(text);
create or replace function public.grille_auth_info(p_email text, p_league_id text default 'pains-suces')
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select json_build_object(
      'exists', true,
      'hasCode', (code_hash is not null and code_hash <> '')
    ) from grilles
      where email = lower(trim(p_email))
        and league_id = coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces')
      limit 1),
    '{"exists":false,"hasCode":false}'::json
  );
$$;

drop function if exists public.verify_player_code(text, text);
create or replace function public.verify_player_code(p_email text, p_code_hash text, p_league_id text default 'pains-suces')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from grilles
    where email = lower(trim(p_email))
      and league_id = coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces')
      and code_hash is not null and code_hash <> ''
      and code_hash = p_code_hash
  );
$$;

drop function if exists public.set_player_code_if_empty(text, text);
create or replace function public.set_player_code_if_empty(p_email text, p_code_hash text, p_league_id text default 'pains-suces')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_league text := coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces');
  v_hash text;
begin
  if v_email = '' or p_code_hash is null or p_code_hash = '' then
    raise exception 'E-mail et code requis.';
  end if;
  select code_hash into v_hash from grilles where email = v_email and league_id = v_league for update;
  if not found then
    raise exception 'Grille introuvable pour cet e-mail.';
  end if;
  if v_hash is not null and v_hash <> '' then
    raise exception 'Un code existe déjà — utilisez-le pour vous connecter.';
  end if;
  update grilles set code_hash = p_code_hash where email = v_email and league_id = v_league;
  return json_build_object('ok', true);
end;
$$;

drop function if exists public.upsert_grille_player(text, text, text, text, jsonb, text, text);
create or replace function public.upsert_grille_player(
  p_email text,
  p_prenom text,
  p_nom text,
  p_equipe text,
  p_payload jsonb,
  p_new_code_hash text default null,
  p_auth_code_hash text default null,
  p_league_id text default 'pains-suces'
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

drop function if exists public.change_player_code(text, text, text);
create or replace function public.change_player_code(
  p_email text,
  p_auth_code_hash text,
  p_new_code_hash text,
  p_league_id text default 'pains-suces'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_league text := coalesce(nullif(lower(trim(p_league_id)), ''), 'pains-suces');
  v_hash text;
begin
  if v_email = '' then
    raise exception 'E-mail obligatoire.';
  end if;
  select code_hash into v_hash from grilles where email = v_email and league_id = v_league for update;
  if not found then
    raise exception 'Grille introuvable pour cet e-mail.';
  end if;
  if v_hash is null or v_hash = '' then
    raise exception 'Aucun code défini — utilisez « Définir mon code ».';
  end if;
  if p_auth_code_hash is null or p_auth_code_hash <> v_hash then
    raise exception 'Code actuel incorrect.';
  end if;
  if p_new_code_hash is null or p_new_code_hash = '' then
    raise exception 'Nouveau code requis.';
  end if;
  update grilles set code_hash = p_new_code_hash where email = v_email and league_id = v_league;
  return json_build_object('ok', true);
end;
$$;

-- 4) Droits
grant execute on function public.grille_auth_info(text, text) to anon, authenticated;
grant execute on function public.verify_player_code(text, text, text) to anon, authenticated;
grant execute on function public.set_player_code_if_empty(text, text, text) to anon, authenticated;
grant execute on function public.upsert_grille_player(text, text, text, text, jsonb, text, text, text) to anon, authenticated;
grant execute on function public.change_player_code(text, text, text, text) to anon, authenticated;
