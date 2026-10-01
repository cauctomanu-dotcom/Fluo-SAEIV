-- One current position per driver, with a random public course identifier.
-- No driver identity, planning, address or journal is readable by anonymous users.
create table public.saeiv_live_courses (
  owner_id uuid primary key references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  public_id uuid not null,
  service_date date not null,
  department text not null check (length(department) <= 30),
  route_id text not null check (length(route_id) <= 200),
  trip_id text not null check (length(trip_id) <= 200),
  line text not null check (length(line) <= 120),
  destination text not null check (length(destination) <= 300),
  stage text not null check (stage in ('hlp','waiting','service')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 100),
  observed_at timestamptz not null,
  delay_seconds integer check (delay_seconds between -86400 and 86400),
  stop_index integer not null check (stop_index >= 0),
  start_index integer not null check (start_index >= 0)
);
alter table public.saeiv_live_courses enable row level security;
create index saeiv_live_course_lookup on public.saeiv_live_courses(department,service_date,route_id,trip_id);
revoke all on public.saeiv_live_courses from public,anon,authenticated;
grant select (public_id,service_date,department,route_id,trip_id,line,destination,stage,latitude,longitude,accuracy_m,observed_at,delay_seconds,stop_index,start_index) on public.saeiv_live_courses to anon;
grant select,insert,update,delete on public.saeiv_live_courses to authenticated;
create policy passenger_recent_positions on public.saeiv_live_courses for select to anon
using (observed_at >= now()-interval '10 minutes' and observed_at <= now()+interval '5 seconds');
create policy driver_own_position_read on public.saeiv_live_courses for select to authenticated
using (owner_id=(select auth.uid()));
create policy driver_own_position_insert on public.saeiv_live_courses for insert to authenticated
with check (owner_id=(select auth.uid()) and observed_at between now()-interval '30 seconds' and now()+interval '5 seconds' and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.organization_id=saeiv_live_courses.organization_id and p.active and p.role='driver'));
create policy driver_own_position_update on public.saeiv_live_courses for update to authenticated
using (owner_id=(select auth.uid()))
with check (owner_id=(select auth.uid()) and observed_at between now()-interval '30 seconds' and now()+interval '5 seconds' and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.organization_id=saeiv_live_courses.organization_id and p.active and p.role='driver'));
create policy driver_own_position_delete on public.saeiv_live_courses for delete to authenticated
using (owner_id=(select auth.uid()));
