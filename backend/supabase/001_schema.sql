-- Mon SAEIV — backend multi-sociétés / multi-appareils
-- Schéma préparatoire Supabase. Ce fichier n'est pas exécuté par GitHub Pages :
-- il sera appliqué au projet Supabase quand la connexion serveur sera activée.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.app_role as enum ('driver','dispatcher','admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_source as enum ('driver','dispatch','auto_hlp');
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.depots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code citext,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  depot_id uuid references public.depots(id) on delete set null,
  matricule citext not null,
  display_name text,
  role public.app_role not null default 'driver',
  network text not null default 'fluo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, matricule)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(user_id) on delete cascade,
  service_date date not null,
  sort_index integer not null default 0,
  type text not null check (type in ('start','regular','school','tad','hlp','annex','availability','cut','pause','end','other')),
  label text,
  line text,
  start_time time,
  end_time time,
  origin text,
  destination text,
  origin_coords jsonb,
  destination_coords jsonb,
  origin_kind text,
  destination_kind text,
  regime text,
  line_distance_km numeric(10,2),
  drive_minutes integer,
  notes text,
  linked jsonb,
  source public.plan_source not null default 'dispatch',
  locked_by_exploitation boolean not null default false,
  status text not null default 'ok' check (status in ('ok','conflict')),
  conflict_minutes integer not null default 0,
  generated_from_prev uuid references public.plan_items(id) on delete set null,
  generated_from_next uuid references public.plan_items(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_items_driver_day_idx
  on public.plan_items(driver_user_id, service_date, start_time, sort_index);
create index if not exists plan_items_org_day_idx
  on public.plan_items(organization_id, service_date, driver_user_id);
create index if not exists profiles_org_role_idx
  on public.profiles(organization_id, role, active);

-- Ces fonctions sont SECURITY DEFINER afin que les politiques RLS puissent connaître
-- la société et le rôle du compte connecté sans créer de récursion sur profiles.
create or replace function public.current_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where user_id = auth.uid() and active = true
  limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid() and active = true
  limit 1
$$;

create or replace function public.is_exploitation_for(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.current_org_id() = target_org
    and public.current_app_role() in ('dispatcher','admin'),
    false
  )
$$;

create or replace function public.touch_plan_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_org uuid;
begin
  select organization_id into driver_org
  from public.profiles
  where user_id = new.driver_user_id and active = true;

  if driver_org is null then
    raise exception 'Conducteur inconnu ou inactif';
  end if;

  -- La société de l'activité est toujours celle du conducteur ciblé.
  new.organization_id := driver_org;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  return new;
end
$$;

drop trigger if exists plan_items_touch on public.plan_items;
create trigger plan_items_touch
before insert or update on public.plan_items
for each row execute function public.touch_plan_item();

alter table public.organizations enable row level security;
alter table public.depots enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.plan_items enable row level security;

-- ORGANISATIONS / DÉPÔTS : visibles uniquement dans sa société.
drop policy if exists organizations_same_company_select on public.organizations;
create policy organizations_same_company_select on public.organizations
for select to authenticated
using (id = public.current_org_id());

drop policy if exists depots_same_company_select on public.depots;
create policy depots_same_company_select on public.depots
for select to authenticated
using (organization_id = public.current_org_id());

drop policy if exists depots_admin_manage on public.depots;
create policy depots_admin_manage on public.depots
for all to authenticated
using (organization_id = public.current_org_id() and public.current_app_role() = 'admin')
with check (organization_id = public.current_org_id() and public.current_app_role() = 'admin');

-- PROFILS : un conducteur voit son compte ; exploitation/admin voit tous les comptes
-- de sa société. Seul l'admin gère les rôles et rattachements.
drop policy if exists profiles_read_scope on public.profiles;
create policy profiles_read_scope on public.profiles
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_exploitation_for(organization_id)
);

drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
for all to authenticated
using (organization_id = public.current_org_id() and public.current_app_role() = 'admin')
with check (organization_id = public.current_org_id() and public.current_app_role() = 'admin');

-- PRÉFÉRENCES : uniquement le propriétaire du compte.
drop policy if exists preferences_self_select on public.user_preferences;
create policy preferences_self_select on public.user_preferences
for select to authenticated using (user_id = auth.uid());
drop policy if exists preferences_self_insert on public.user_preferences;
create policy preferences_self_insert on public.user_preferences
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists preferences_self_update on public.user_preferences;
create policy preferences_self_update on public.user_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PLANNINGS :
--  • conducteur = son planning uniquement ;
--  • exploitation/admin = tous les conducteurs de la société ;
--  • les activités officielles verrouillées ne sont pas modifiables par le conducteur.
drop policy if exists plan_items_read_scope on public.plan_items;
create policy plan_items_read_scope on public.plan_items
for select to authenticated
using (
  driver_user_id = auth.uid()
  or public.is_exploitation_for(organization_id)
);

drop policy if exists plan_items_driver_insert on public.plan_items;
create policy plan_items_driver_insert on public.plan_items
for insert to authenticated
with check (
  driver_user_id = auth.uid()
  and organization_id = public.current_org_id()
  and source = 'driver'
  and locked_by_exploitation = false
);

drop policy if exists plan_items_driver_update on public.plan_items;
create policy plan_items_driver_update on public.plan_items
for update to authenticated
using (
  driver_user_id = auth.uid()
  and source = 'driver'
  and locked_by_exploitation = false
)
with check (
  driver_user_id = auth.uid()
  and organization_id = public.current_org_id()
  and source = 'driver'
  and locked_by_exploitation = false
);

drop policy if exists plan_items_driver_delete on public.plan_items;
create policy plan_items_driver_delete on public.plan_items
for delete to authenticated
using (
  driver_user_id = auth.uid()
  and source = 'driver'
  and locked_by_exploitation = false
);

drop policy if exists plan_items_exploitation_manage on public.plan_items;
create policy plan_items_exploitation_manage on public.plan_items
for all to authenticated
using (public.is_exploitation_for(organization_id))
with check (public.is_exploitation_for(organization_id));

-- Realtime : les politiques RLS continuent de filtrer ce que chaque compte reçoit.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.plan_items;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
