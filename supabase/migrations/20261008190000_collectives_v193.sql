create table if not exists public.saeiv_collective_tickets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 reference text not null,
 title text not null,
 nature text not null default 'collective',
 pattern text not null check(pattern in ('one_way','round_trip','stay_return')),
 recurrence text not null default 'once' check(recurrence in ('once','weekly')),
 service_date date not null,
 valid_from date,
 valid_until date,
 weekdays integer[] not null default '{}'::integer[],
 legs jsonb not null check(jsonb_typeof(legs)='array'),
 passengers integer,
 vehicle_type text,
 status text not null default 'unassigned',
 notes text,
 created_at timestamptz not null default now(),
 unique(organization_id,reference)
);
alter table public.saeiv_collective_tickets enable row level security;
create policy saeiv_collective_read on public.saeiv_collective_tickets for select to authenticated using(private.is_exploitation_for(organization_id));
create policy saeiv_collective_manage on public.saeiv_collective_tickets for all to authenticated using(private.is_exploitation_for(organization_id)) with check(private.is_exploitation_for(organization_id));
grant select,insert,update,delete on public.saeiv_collective_tickets to authenticated;