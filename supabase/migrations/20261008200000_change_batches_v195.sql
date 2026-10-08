-- SAEIV 1.0.95 — approval groups for already published day changes.
create table if not exists public.saeiv_change_batches (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 service_date date not null,
 reason text not null check(length(trim(reason))>0),
 kind text not null check(kind in ('reassignment','manual')),
 sick_driver_user_id uuid references public.profiles(user_id),
 status text not null default 'pending' check(status in ('pending','refused','published','cancelled')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 finalized_by uuid references auth.users(id),
 finalized_at timestamptz
);
create index if not exists saeiv_change_batches_org_date on public.saeiv_change_batches(organization_id,service_date,status);
alter table public.saeiv_change_batches enable row level security;
create policy saeiv_batch_dispatch_read on public.saeiv_change_batches for select to authenticated using(private.is_exploitation_for(organization_id));
grant select on public.saeiv_change_batches to authenticated;
alter table public.saeiv_change_requests add column if not exists batch_id uuid references public.saeiv_change_batches(id);
alter table public.saeiv_change_requests add column if not exists response_exempt boolean not null default false;
create index if not exists saeiv_change_requests_batch on public.saeiv_change_requests(batch_id);
-- Drivers cannot INSERT or UPDATE change requests directly; existing narrow RPCs stay authoritative.
