-- 2026 Toussaint / René Antoni.
-- Source: three internal operating-company journey listings supplied by a company driver.
-- Do not mistake printed TAD/REGULIER row types or GTFS trip identifiers for route names.
-- Validity: school-break operating plan 17 October to 1 November inclusive;
-- never infer school-term operation from this exceptional-service document.
create table if not exists public.saeiv_operator_driver_memberships (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 operator_name text not null,
 driver_user_id uuid not null references public.profiles(user_id),
 valid_from date not null,
 valid_until date,
 assignment_kind text not null default 'test_group',
 source_description text not null default '',
 created_at timestamptz not null default now(),
 unique(organization_id,operator_name,driver_user_id,valid_from),
 constraint saeiv_operator_membership_dates check(valid_until is null or valid_until>=valid_from)
);
create index if not exists saeiv_operator_membership_dates_index
 on public.saeiv_operator_driver_memberships(organization_id,operator_name,valid_from,valid_until);
alter table public.saeiv_operator_driver_memberships enable row level security;
drop policy if exists saeiv_operator_memberships_dispatch_read on public.saeiv_operator_driver_memberships;
create policy saeiv_operator_memberships_dispatch_read
 on public.saeiv_operator_driver_memberships for select to authenticated
 using(private.is_exploitation_for(organization_id));
grant select on public.saeiv_operator_driver_memberships to authenticated;
revoke insert,update,delete on public.saeiv_operator_driver_memberships from anon,authenticated;

-- Only exact short codes confirmed both on the sheets and in Fluo department catalogs.
-- 54 R330..R380 remain department 54 even where the paper's legacy field reads 63.
with confirmed(department,line_code,gtfs_route_id) as (
 values
 ('57','57R026','1006672'), -- Chateau-Salins / Morhange
 ('57','57R027','1006282'), -- Chateau-Salins / Metz
 ('57','57R028','1006673'), -- Dieuze / Chateau-Salins
 ('57','57R033','1006677'), -- Chateau-Salins / Sarrebourg
 ('57','57R041','1006683'), -- Morhange / Dieuze
 ('57','57R166','1006717'),-- Walscheid / Sarrebourg
 ('54','54R330','1004062'),-- Pont-a-Mousson / Nancy
 ('54','54R340','1004788'),-- Arraye-et-Han / Nomeny / Pont-a-Mousson
 ('54','54R350','1004063'),-- Chateau-Salins / Nancy
 ('54','54R360','1004064'),-- Chambrey / Nancy
 ('54','54R370','1004789'),-- Nomeny / Nancy
 ('54','54R380','1004066') -- Ecuelle / Nancy
)
insert into public.saeiv_company_lines
(organization_id,network,department,line_code,gtfs_route_id,start_date,end_date,active)
select o.id,'Fluo Grand Est',c.department,c.line_code,c.gtfs_route_id,
 date '2026-10-17',date '2026-11-01',true
from confirmed c cross join public.organizations o
where o.code::text='PILOTE'
and not exists (
 select 1 from public.saeiv_company_lines x
 where x.organization_id=o.id and x.department=c.department and x.line_code=c.line_code
   and x.start_date=date '2026-10-17' and x.end_date=date '2026-11-01'
);

-- Deterministic choice of 27 of the 100 TEST drivers; never move users to a second
-- tenant (that would make their historic drafts unavailable to the current admin).
with eligible as (
 select p.organization_id,p.user_id,
 row_number() over(partition by p.organization_id order by p.matricule,p.user_id) rn
 from public.profiles p join public.organizations o on o.id=p.organization_id
 where o.code::text='PILOTE' and p.role='driver' and p.is_test_driver is true and p.active is true
), selected as (
 select organization_id,user_id from eligible where rn<=27
)
insert into public.saeiv_operator_driver_memberships
 (organization_id,operator_name,driver_user_id,valid_from,valid_until,assignment_kind,source_description)
select organization_id,'René Antoni',user_id,date '2026-10-17',date '2026-11-01',
'test_group','27 conducteurs tests retenus pour simuler les services internes Toussaint 2026; attribution des identités fictives, pas une liste nominative salariés'
from selected
on conflict (organization_id,operator_name,driver_user_id,valid_from) do nothing;

-- No existing driver, service, draft or published day is mutated by this import.
