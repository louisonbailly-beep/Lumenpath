-- Lumenpath : schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor (projet vide).

-- ─── Rôles ───────────────────────────────────────────────────────────
create type role_app as enum ('utilisateur', 'editeur_catalogue', 'admin');
create type consent_kind as enum ('bureau_etudes', 'ia');

-- ─── Profils ─────────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  prenom      text not null default '',
  nom         text not null default '',
  societe     text not null default '',
  departement text not null default '',
  telephone   text,
  role        role_app not null default 'utilisateur',
  created_at  timestamptz not null default now()
);

-- Admin = rôle admin ET session validée en 2FA (aal2).
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Profil créé automatiquement à l'inscription, à partir des champs du formulaire
-- (supabase.auth.signUp({ email, password, options: { data: { prenom, nom, ... } } })).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, prenom, nom, societe, departement, telephone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'societe', ''),
    coalesce(new.raw_user_meta_data ->> 'departement', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
create policy "profil : lecture du sien"  on profiles for select using (auth.uid() = id);
create policy "profil : lecture admin"    on profiles for select using (is_admin());
create policy "profil : modif du sien"    on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profil : modif admin"      on profiles for update using (is_admin());

-- Un utilisateur ne peut modifier que ses coordonnées, jamais son rôle.
revoke update on profiles from authenticated;
grant update (prenom, nom, societe, departement, telephone) on profiles to authenticated;

-- ─── Projets (entrées + résultats des calculateurs) ─────────────────
create table projects (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references profiles(id) on delete cascade,
  tool       text not null,
  name       text,
  inputs     jsonb not null,
  results    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on projects (owner, created_at desc);

alter table projects enable row level security;
create policy "projets : les siens" on projects for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- ─── Consentements (partage bureau d'études, IA) ────────────────────
create table consents (
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  kind       consent_kind not null,
  granted    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table consents enable row level security;
create policy "consentements : les siens" on consents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "consentements : lecture admin" on consents for select using (is_admin());

-- ─── Journal d'audit ────────────────────────────────────────────────
-- Lecture réservée aux admins (2FA). Écriture uniquement via log_action(),
-- jamais directement : personne ne peut modifier ni effacer une ligne.
create table audit_log (
  id     bigint generated always as identity primary key,
  actor  uuid,
  action text not null,
  detail jsonb,
  ip     inet,
  device text,
  at     timestamptz not null default now()
);

alter table audit_log enable row level security;
create policy "audit : lecture admin" on audit_log for select using (is_admin());
revoke insert, update, delete on audit_log from anon, authenticated;

create or replace function log_action(p_action text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
begin
  insert into audit_log (actor, action, detail, ip, device)
  values (
    auth.uid(), p_action, p_detail,
    nullif(split_part(h ->> 'x-forwarded-for', ',', 1), '')::inet,
    left(h ->> 'user-agent', 300)
  );
end $$;
-- ─── Droits d'exécution des fonctions ───────────────────────────────
-- Par défaut, Postgres et Supabase autorisent tout le monde (y compris anon)
-- à appeler ces fonctions via /rest/v1/rpc. On restreint :
--  - handle_new_user : uniquement via le trigger, jamais appelable ;
--  - is_admin, log_action : utilisateurs connectés seulement.
revoke execute on function handle_new_user()          from public, anon, authenticated;
revoke execute on function is_admin()                 from public, anon, authenticated;
revoke execute on function log_action(text, jsonb)    from public, anon, authenticated;
grant  execute on function is_admin()                 to authenticated;
grant  execute on function log_action(text, jsonb)    to authenticated;
