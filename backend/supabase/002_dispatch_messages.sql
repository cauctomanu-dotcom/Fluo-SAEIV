-- Mon SAEIV 1.0.80 — consignes exploitation, correspondances et accusés de lecture.

create table if not exists public.dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('course_start','connection')),
  scope text not null default 'permanent' check (scope in ('permanent','exceptional')),
  active boolean not null default true,
  department text not null,
  target_line text not null,
  target_trip_id text,
  target_departure_time time,
  service_date date,
  stop_id text,
  stop_name text,
  connecting_line text,
  connecting_time time,
  title text not null,
  body text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispatch_messages_exceptional_date_chk
    check (scope <> 'exceptional' or service_date is not null),
  constraint dispatch_messages_connection_chk
    check (
      kind <> 'connection'
      or (stop_id is not null and stop_name is not null and connecting_line is not null and connecting_time is not null)
    )
);

create index if not exists dispatch_messages_route_idx
  on public.dispatch_messages(organization_id, active, department, target_line, kind);
create index if not exists dispatch_messages_date_idx
  on public.dispatch_messages(organization_id, service_date, active);

create table if not exists public.dispatch_message_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.dispatch_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(user_id) on delete cascade,
  occurrence_key text not null,
  service_date date not null,
  route_short text,
  trip_id text,
  stop_id text,
  driver_matricule text,
  driver_display_name text,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(message_id, driver_user_id, occurrence_key)
);

create index if not exists dispatch_message_ack_message_idx
  on public.dispatch_message_acknowledgements(message_id, acknowledged_at desc);
create index if not exists dispatch_message_ack_driver_idx
  on public.dispatch_message_acknowledgements(driver_user_id, service_date desc);

create or replace function private.touch_dispatch_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_exploitation_for(private.current_org_id()) then
    raise exception 'Accès exploitation requis';
  end if;
  new.organization_id := private.current_org_id();
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  return new;
end
$$;

drop trigger if exists dispatch_messages_touch on public.dispatch_messages;
create trigger dispatch_messages_touch
before insert or update on public.dispatch_messages
for each row execute function private.touch_dispatch_message();

alter table public.dispatch_messages enable row level security;
alter table public.dispatch_message_acknowledgements enable row level security;

drop policy if exists dispatch_messages_read_company on public.dispatch_messages;
create policy dispatch_messages_read_company on public.dispatch_messages
for select to authenticated
using (organization_id = private.current_org_id());

drop policy if exists dispatch_messages_exploitation_manage on public.dispatch_messages;
create policy dispatch_messages_exploitation_manage on public.dispatch_messages
for all to authenticated
using (private.is_exploitation_for(organization_id))
with check (organization_id = private.current_org_id() and private.current_app_role() in ('dispatcher','admin'));

drop policy if exists dispatch_ack_read_scope on public.dispatch_message_acknowledgements;
create policy dispatch_ack_read_scope on public.dispatch_message_acknowledgements
for select to authenticated
using (
  driver_user_id = auth.uid()
  or private.is_exploitation_for(organization_id)
);

drop policy if exists dispatch_ack_driver_insert on public.dispatch_message_acknowledgements;
create policy dispatch_ack_driver_insert on public.dispatch_message_acknowledgements
for insert to authenticated
with check (
  driver_user_id = auth.uid()
  and organization_id = private.current_org_id()
  and exists (
    select 1 from public.dispatch_messages m
    where m.id = message_id and m.organization_id = private.current_org_id()
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.dispatch_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.dispatch_message_acknowledgements;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
