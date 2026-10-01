alter table public.saeiv_live_courses add column served_stop_indices integer[];
grant select(served_stop_indices) on public.saeiv_live_courses to anon;
