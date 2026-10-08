-- Mon SAEIV 1.0.92 | Enterprise & controlled planning, additive / backwards compatible
-- Legacy plan_items are NOT modified here. New planning stays invisible to drivers until a publication.
alter table public.organizations
  add column if not exists description text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
alter table public.depots
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists contract_type text,
  add column if not exists weekly_contract_minutes integer,
  add column if not exists operational_permissions jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists saeiv_weekly_contract_range;
alter table public.profiles add constraint saeiv_weekly_contract_range check (weekly_contract_minutes between 0 and 3600);
create unique index if not exists saeiv_depot_org_id_key on public.depots(organization_id,id);

create table if not exists public.saeiv_company_lines (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 network text not null default 'fluo',
 department text not null,
 line_code text not null,
 gtfs_route_id text,
 start_date date not null default current_date,
 end_date date,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (end_date is null or end_date >= start_date),
 unique (id,organization_id)
);
create index if not exists saeiv_company_lines_org_idx on public.saeiv_company_lines(organization_id,department,line_code);
create table if not exists public.saeiv_line_depots (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 line_id uuid not null,
 depot_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(line_id,depot_id),
 foreign key(line_id,organization_id) references public.saeiv_company_lines(id,organization_id) on delete cascade,
 foreign key(organization_id,depot_id) references public.depots(organization_id,id) on delete cascade
);
create table if not exists public.saeiv_vehicle_rules (
 line_id uuid not null,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 vehicle_type text not null check(vehicle_type in ('bus','minibus','van')),
 policy text not null check(policy in ('required','allowed','preferred','forbidden')),
 updated_at timestamptz not null default now(),
 primary key(line_id,vehicle_type),
 foreign key(line_id,organization_id) references public.saeiv_company_lines(id,organization_id) on delete cascade
);
create table if not exists public.saeiv_driver_secondary_depots (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid not null references public.profiles(user_id) on delete cascade,
 depot_id uuid not null,
 active boolean not null default true,
 from_date date,
 to_date date,
 primary key(driver_user_id,depot_id),
 foreign key(organization_id,depot_id) references public.depots(organization_id,id) on delete cascade
);
create table if not exists public.saeiv_driver_line_skills (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid not null references public.profiles(user_id) on delete cascade,
 line_code text not null,
 department text,
 allowed boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(driver_user_id,line_code,department)
);
create table if not exists public.saeiv_vehicle_exceptions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 line_id uuid not null,
 service_date date not null,
 vehicle_type text not null check(vehicle_type in ('bus','minibus','van')),
 reason text,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 foreign key(line_id,organization_id) references public.saeiv_company_lines(id,organization_id)
);
create table if not exists public.saeiv_matricule_sequences (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 depot_id uuid not null,
 last_number bigint not null default 0,
 primary key(organization_id,depot_id),
 foreign key(organization_id,depot_id) references public.depots(organization_id,id)
);
create table if not exists public.saeiv_planning_locks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 start_date date not null,
 end_date date not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 owner_name text not null default 'Exploitant',
 acquired_at timestamptz not null default now(),
 heartbeat_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '90 seconds'),
 check(end_date>=start_date)
);
create index if not exists saeiv_locks_org_dates on public.saeiv_planning_locks(organization_id,start_date,end_date);
create table if not exists public.saeiv_planning_days (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid not null references public.profiles(user_id) on delete restrict,
 service_date date not null,
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
 status text not null default 'draft' check(status in ('draft','validated','published')),
 revision bigint not null default 1,
 updated_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,driver_user_id,service_date)
);
create index if not exists saeiv_plan_days_date on public.saeiv_planning_days(organization_id,service_date);
create table if not exists public.saeiv_published_days (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid not null references public.profiles(user_id) on delete restrict,
 service_date date not null,
 items jsonb not null check(jsonb_typeof(items)='array'),
 revision bigint not null default 1,
 published_by uuid not null references auth.users(id),
 published_at timestamptz not null default now(),
 unique (organization_id,driver_user_id,service_date)
);
create index if not exists saeiv_published_driver_date on public.saeiv_published_days(driver_user_id,service_date);
create table if not exists public.saeiv_change_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid not null references public.profiles(user_id) on delete restrict,
 service_date date not null,
 base_revision bigint not null,
 previous_items jsonb not null check(jsonb_typeof(previous_items)='array'),
 proposed_items jsonb not null check(jsonb_typeof(proposed_items)='array'),
 summary text not null,
 status text not null default 'pending' check(status in ('pending','accepted','refused','published','cancelled')),
 seen_at timestamptz,
 response_at timestamptz,
 finalized_at timestamptz,
 created_by uuid not null default auth.uid() references auth.users(id),
 finalized_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 check (length(trim(summary)) > 0)
);
create index if not exists saeiv_changes_pending on public.saeiv_change_requests(organization_id,status,service_date);
create table if not exists public.saeiv_notifications (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 title text not null,
 message text not null,
 payload jsonb not null default '{}'::jsonb,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists saeiv_notifications_recipient on public.saeiv_notifications(recipient_user_id,created_at desc);
create table if not exists public.saeiv_planning_audit (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 driver_user_id uuid references auth.users(id),
 service_date date,
 event text not null,
 old_items jsonb,
 new_items jsonb,
 actor_id uuid references auth.users(id),
 change_id uuid,
 details jsonb not null default '{}'::jsonb,
 at timestamptz not null default now()
);
create index if not exists saeiv_audit_org_date on public.saeiv_planning_audit(organization_id,service_date,at desc);

-- All new public-schema tables have tenant-scoped RLS.
do $$
declare table_name text;
begin
 foreach table_name in array array[
  'saeiv_company_lines','saeiv_line_depots','saeiv_vehicle_rules','saeiv_driver_secondary_depots',
  'saeiv_driver_line_skills','saeiv_vehicle_exceptions','saeiv_matricule_sequences',
  'saeiv_planning_locks','saeiv_planning_days','saeiv_published_days',
  'saeiv_change_requests','saeiv_notifications','saeiv_planning_audit'
 ] loop
  execute format('alter table public.%I enable row level security',table_name);
 end loop;
end $$;
create policy saeiv_org_admin_update on public.organizations for update to authenticated
 using (id=private.current_org_id() and private.current_app_role()='admin'::public.app_role)
 with check (id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_lines_read on public.saeiv_company_lines for select to authenticated using (organization_id=private.current_org_id());
create policy saeiv_lines_admin on public.saeiv_company_lines for all to authenticated using (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role) with check (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_line_depots_read on public.saeiv_line_depots for select to authenticated using (organization_id=private.current_org_id());
create policy saeiv_line_depots_admin on public.saeiv_line_depots for all to authenticated using (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role) with check (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_vehicle_rules_read on public.saeiv_vehicle_rules for select to authenticated using (organization_id=private.current_org_id());
create policy saeiv_vehicle_rules_admin on public.saeiv_vehicle_rules for all to authenticated using (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role) with check (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_depot_assignments_read on public.saeiv_driver_secondary_depots for select to authenticated using (organization_id=private.current_org_id() and (driver_user_id=auth.uid() or private.is_exploitation_for(organization_id)));
create policy saeiv_depot_assignments_admin on public.saeiv_driver_secondary_depots for all to authenticated using (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role) with check (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_skills_read on public.saeiv_driver_line_skills for select to authenticated using (organization_id=private.current_org_id() and (driver_user_id=auth.uid() or private.is_exploitation_for(organization_id)));
create policy saeiv_skills_dispatch on public.saeiv_driver_line_skills for all to authenticated using (private.is_exploitation_for(organization_id)) with check (private.is_exploitation_for(organization_id));
create policy saeiv_exceptions_dispatch on public.saeiv_vehicle_exceptions for all to authenticated using (private.is_exploitation_for(organization_id)) with check (private.is_exploitation_for(organization_id) and created_by=auth.uid());
create policy saeiv_matricule_admin_read on public.saeiv_matricule_sequences for select to authenticated using (organization_id=private.current_org_id() and private.current_app_role()='admin'::public.app_role);
create policy saeiv_locks_read on public.saeiv_planning_locks for select to authenticated using (private.is_exploitation_for(organization_id));
create policy saeiv_days_dispatch on public.saeiv_planning_days for all to authenticated using (private.is_exploitation_for(organization_id)) with check (private.is_exploitation_for(organization_id));
create policy saeiv_published_read on public.saeiv_published_days for select to authenticated using ((driver_user_id=auth.uid() and organization_id=private.current_org_id()) or private.is_exploitation_for(organization_id));
create policy saeiv_changes_read on public.saeiv_change_requests for select to authenticated using ((driver_user_id=auth.uid() and organization_id=private.current_org_id()) or private.is_exploitation_for(organization_id));
-- Proposal creation and all state transitions are RPC-only: dispatchers cannot spoof a driver's consent.
create policy saeiv_notifications_self_read on public.saeiv_notifications for select to authenticated using (recipient_user_id=auth.uid() and organization_id=private.current_org_id());
create policy saeiv_notifications_self_update on public.saeiv_notifications for update to authenticated using (recipient_user_id=auth.uid() and organization_id=private.current_org_id()) with check (recipient_user_id=auth.uid() and organization_id=private.current_org_id());
create policy saeiv_audit_dispatch_read on public.saeiv_planning_audit for select to authenticated using (private.is_exploitation_for(organization_id));
create policy saeiv_audit_driver_read on public.saeiv_planning_audit for select to authenticated using (driver_user_id=auth.uid() and organization_id=private.current_org_id());

-- Client writes may not directly update published snapshots or audit records.
grant select,insert,update,delete on public.saeiv_company_lines,public.saeiv_line_depots,public.saeiv_vehicle_rules,
 public.saeiv_driver_secondary_depots,public.saeiv_driver_line_skills,public.saeiv_vehicle_exceptions,
 public.saeiv_planning_days to authenticated;
grant select on public.saeiv_published_days,public.saeiv_planning_locks,public.saeiv_planning_audit,public.saeiv_matricule_sequences,public.saeiv_change_requests to authenticated;
grant select on public.saeiv_notifications to authenticated;
grant update(read_at) on public.saeiv_notifications to authenticated;
grant usage,select on sequence public.saeiv_planning_audit_id_seq to authenticated;

-- Require an active planning lock for every draft write, including DELETE.
create or replace function public.saeiv_require_planning_lock() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare oid uuid; d date;
begin
 if tg_op='DELETE' then
   oid=old.organization_id;d=old.service_date;
 else
   oid=new.organization_id;d=new.service_date;
 end if;
 if not exists(select 1 from public.saeiv_planning_locks l where l.organization_id=oid
   and l.owner_id=auth.uid() and l.start_date<=d and l.end_date>=d and l.expires_at>now()) then
   raise exception 'VERROU_REQUIS: obtenir le verrou du planning avant toute modification';
 end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.driver_user_id<>old.driver_user_id or new.service_date<>old.service_date) then
   raise exception 'Déplacement inter-conducteur/jour : créer le nouvel enregistrement sous verrou';
 end if;
 if tg_op<>'DELETE' then
   new.updated_at=now();
   if tg_op='UPDATE' then new.revision=old.revision+1;end if;
   return new;
 end if;
 return old;
end $$;
drop trigger if exists saeiv_plan_day_lock_required on public.saeiv_planning_days;
create trigger saeiv_plan_day_lock_required before insert or update or delete on public.saeiv_planning_days for each row execute function public.saeiv_require_planning_lock();

-- Privileged mutations are deliberately narrow. Never grant to anon/PUBLIC.
create or replace function public.saeiv_acquire_lock(p_start date,p_end date,p_name text default 'Exploitant')
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare org uuid; existing record; lid uuid;
begin
 org=private.current_org_id();
 if org is null or not private.is_exploitation_for(org) or p_start is null or p_end is null or p_end<p_start or p_end>p_start+interval '62 days' then raise exception 'Interdit / période invalide';end if;
 perform pg_advisory_xact_lock(hashtext(org::text));
 delete from public.saeiv_planning_locks where organization_id=org and expires_at<=now();
 select l.id,l.owner_id,l.owner_name,l.acquired_at into existing from public.saeiv_planning_locks l
  where l.organization_id=org and l.start_date<=p_end and l.end_date>=p_start
    and l.owner_id<>auth.uid() and l.expires_at>now() limit 1;
 if found then return jsonb_build_object('ok',false,'owner',existing.owner_name,'since',existing.acquired_at);end if;
 select id into lid from public.saeiv_planning_locks
  where organization_id=org and owner_id=auth.uid() and start_date=p_start and end_date=p_end limit 1;
 if lid is null then
   insert into public.saeiv_planning_locks(organization_id,owner_id,owner_name,start_date,end_date)
   values(org,auth.uid(),left(coalesce(nullif(trim(p_name),''),'Exploitant'),100),p_start,p_end) returning id into lid;
 else
   update public.saeiv_planning_locks set heartbeat_at=now(),expires_at=now()+interval '90 seconds' where id=lid;
 end if;
 return jsonb_build_object('ok',true,'id',lid);
end $$;
create or replace function public.saeiv_heartbeat_lock(p_id uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 update public.saeiv_planning_locks set heartbeat_at=now(),expires_at=now()+interval '90 seconds'
  where id=p_id and owner_id=auth.uid() and expires_at>now()
  and private.is_exploitation_for(organization_id);
 return found;
end $$;
create or replace function public.saeiv_release_lock(p_id uuid,p_force boolean default false)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 delete from public.saeiv_planning_locks where id=p_id and
 private.is_exploitation_for(organization_id) and
 (owner_id=auth.uid() or (p_force and private.current_app_role()='admin'::public.app_role))
 returning id into p_id;
 return found;
end $$;
create or replace function public.saeiv_next_matricule(p_depot uuid)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare org uuid; company_code text; depot_code text; seq bigint;
begin
 org=private.current_org_id();
 if org is null or private.current_app_role()<>'admin'::public.app_role then raise exception 'Réservé à l’administrateur';end if;
 select upper(left(regexp_replace(code::text,'[^[:alnum:]]','','g'),1)) into company_code from public.organizations where id=org;
 select upper(left(regexp_replace(code::text,'[^[:alnum:]]','','g'),2)) into depot_code from public.depots where id=p_depot and organization_id=org and active;
 if company_code is null or depot_code is null or length(depot_code)<2 then raise exception 'Code entreprise/dépôt invalide';end if;
 insert into public.saeiv_matricule_sequences(organization_id,depot_id,last_number)
 values(org,p_depot,1)
 on conflict(organization_id,depot_id) do update set last_number=public.saeiv_matricule_sequences.last_number+1
 returning last_number into seq;
 return company_code||depot_code||lpad(seq::text,3,'0');
end $$;

create or replace function public.saeiv_validate_day(p_day uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare r public.saeiv_planning_days%rowtype;
begin
 select * into r from public.saeiv_planning_days where id=p_day for update;
 if not found or not private.is_exploitation_for(r.organization_id) then raise exception 'Planning non autorisé';end if;
 if r.status<>'draft' then raise exception 'Seul un brouillon peut être validé';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=r.organization_id and owner_id=auth.uid() and r.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 update public.saeiv_planning_days set status='validated',updated_by=auth.uid() where id=p_day;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,new_items,actor_id)
 values(r.organization_id,r.driver_user_id,r.service_date,'validated',r.items,auth.uid());
 return true;
end $$;
create or replace function public.saeiv_publish_first_day(p_day uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare r public.saeiv_planning_days%rowtype;
begin
 select * into r from public.saeiv_planning_days where id=p_day for update;
 if not found or not private.is_exploitation_for(r.organization_id) then raise exception 'Planning non autorisé';end if;
 if r.status<>'validated' then raise exception 'Valider le brouillon avant la publication';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=r.organization_id and owner_id=auth.uid() and r.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 if exists(select 1 from public.saeiv_published_days where organization_id=r.organization_id and driver_user_id=r.driver_user_id and service_date=r.service_date) then raise exception 'Planning déjà communiqué : utiliser une demande d’accord';end if;
 insert into public.saeiv_published_days(organization_id,driver_user_id,service_date,items,published_by)
 values(r.organization_id,r.driver_user_id,r.service_date,r.items,auth.uid());
 update public.saeiv_planning_days set status='published',updated_by=auth.uid() where id=p_day;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,new_items,actor_id)
 values(r.organization_id,r.driver_user_id,r.service_date,'first_publication',r.items,auth.uid());
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(r.organization_id,r.driver_user_id,'planning_published','Nouveau planning', 'Votre planning du '||to_char(r.service_date,'DD/MM/YYYY')||' est disponible.');
 return true;
end $$;
create or replace function public.saeiv_propose_change(p_driver uuid,p_date date,p_items jsonb,p_summary text)
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare org uuid; official public.saeiv_published_days%rowtype; cid uuid;
begin
 org=private.current_org_id();
 if org is null or not private.is_exploitation_for(org) then raise exception 'Non autorisé';end if;
 if jsonb_typeof(p_items)<>'array' or length(trim(coalesce(p_summary,'')))=0 then raise exception 'Planning/description invalide';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=org and owner_id=auth.uid() and p_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 select * into official from public.saeiv_published_days where organization_id=org and driver_user_id=p_driver and service_date=p_date for update;
 if not found then raise exception 'Première publication absente : publier le brouillon avant de proposer un changement';end if;
 if official.items=p_items then raise exception 'Aucune différence entre les deux plannings';end if;
 if exists(select 1 from public.saeiv_change_requests where organization_id=org and driver_user_id=p_driver and service_date=p_date and status in ('pending','accepted')) then raise exception 'Une modification est déjà en cours';end if;
 insert into public.saeiv_change_requests(organization_id,driver_user_id,service_date,base_revision,previous_items,proposed_items,summary,created_by)
 values(org,p_driver,p_date,official.revision,official.items,p_items,p_summary,auth.uid()) returning id into cid;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(org,p_driver,p_date,'change_proposed',official.items,p_items,auth.uid(),cid);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message,payload)
 values(org,p_driver,'change_proposed','Modification proposée',p_summary,jsonb_build_object('change_id',cid));
 return cid;
end $$;
create or replace function public.saeiv_cancel_change(p_change uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype;
begin
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or not private.is_exploitation_for(x.organization_id) or x.status not in ('pending','accepted') then raise exception 'Proposition non annulable';end if;
 update public.saeiv_change_requests set status='cancelled' where id=p_change;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(x.organization_id,x.driver_user_id,x.service_date,'change_cancelled',x.previous_items,x.proposed_items,auth.uid(),p_change);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(x.organization_id,x.driver_user_id,'change_cancelled','Modification annulée','La proposition de changement a été retirée par exploitation.');
 return true;
end $$;
create or replace function public.saeiv_mark_change_seen(p_change uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype;
begin
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or x.driver_user_id<>auth.uid() or x.organization_id<>private.current_org_id() then raise exception 'Proposition non autorisée';end if;
 if x.seen_at is null then
   update public.saeiv_change_requests set seen_at=now() where id=p_change;
   insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,actor_id,change_id)
   values(x.organization_id,x.driver_user_id,x.service_date,'change_seen',auth.uid(),p_change);
 end if;
 return true;
end $$;
create or replace function public.saeiv_respond_change(p_change uuid,p_response text)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype;
begin
 if p_response not in ('accepted','refused') then raise exception 'Réponse invalide';end if;
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or x.driver_user_id<>auth.uid() or x.organization_id<>private.current_org_id() or x.status<>'pending' then raise exception 'Proposition introuvable, déjà traitée ou non autorisée';end if;
 update public.saeiv_change_requests set status=p_response,response_at=now(),seen_at=coalesce(seen_at,now()) where id=p_change;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(x.organization_id,x.driver_user_id,x.service_date,'change_'||p_response,x.previous_items,x.proposed_items,auth.uid(),p_change);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(x.organization_id,x.created_by,'change_response','Réponse conducteur',
 'Votre proposition de modification pour le '||to_char(x.service_date,'DD/MM/YYYY')||' a été '||case when p_response='accepted' then 'acceptée' else 'refusée' end||'.');
 return true;
end $$;
create or replace function public.saeiv_finalize_change(p_change uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype; official public.saeiv_published_days%rowtype;
begin
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or not private.is_exploitation_for(x.organization_id) or x.status<>'accepted' then raise exception 'Seule une proposition acceptée peut être publiée par exploitation';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=x.organization_id and owner_id=auth.uid() and x.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 select * into official from public.saeiv_published_days where organization_id=x.organization_id and driver_user_id=x.driver_user_id and service_date=x.service_date for update;
 if not found or official.revision<>x.base_revision then raise exception 'Le planning officiel a changé entre-temps; recréer la proposition';end if;
 update public.saeiv_published_days set items=x.proposed_items,revision=revision+1,published_at=now(),published_by=auth.uid() where id=official.id;
 update public.saeiv_change_requests set status='published',finalized_by=auth.uid(),finalized_at=now(),published_at=now() where id=p_change;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(x.organization_id,x.driver_user_id,x.service_date,'change_published',x.previous_items,x.proposed_items,auth.uid(),p_change);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(x.organization_id,x.driver_user_id,'change_published','Planning modifié','Votre planning du '||to_char(x.service_date,'DD/MM/YYYY')||' a été mis à jour après votre accord.');
 return true;
end $$;

revoke all on function public.saeiv_acquire_lock(date,date,text), public.saeiv_heartbeat_lock(uuid),
 public.saeiv_release_lock(uuid,boolean), public.saeiv_next_matricule(uuid),
 public.saeiv_validate_day(uuid), public.saeiv_publish_first_day(uuid),
 public.saeiv_propose_change(uuid,date,jsonb,text),public.saeiv_cancel_change(uuid),
 public.saeiv_mark_change_seen(uuid), public.saeiv_respond_change(uuid,text),
 public.saeiv_finalize_change(uuid) from public,anon;
grant execute on function public.saeiv_acquire_lock(date,date,text), public.saeiv_heartbeat_lock(uuid),
 public.saeiv_release_lock(uuid,boolean), public.saeiv_next_matricule(uuid),
 public.saeiv_validate_day(uuid), public.saeiv_publish_first_day(uuid),
 public.saeiv_propose_change(uuid,date,jsonb,text),public.saeiv_cancel_change(uuid),
 public.saeiv_mark_change_seen(uuid), public.saeiv_respond_change(uuid,text),
 public.saeiv_finalize_change(uuid) to authenticated;
-- Existing planning is unchanged. Realtime is scoped by the existing RLS policies.
do $$
declare tab text;
begin
 foreach tab in array array['saeiv_planning_days','saeiv_planning_locks','saeiv_change_requests','saeiv_published_days','saeiv_notifications'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
    execute format('alter publication supabase_realtime add table public.%I',tab);
  end if;
 end loop;
end $$;
