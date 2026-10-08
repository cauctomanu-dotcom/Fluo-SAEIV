-- SAEIV 1.0.100 — server-verified change request containing a recalculated provisional service envelope.
-- Keep the existing authoritative RPC for vacancy, driver scope, locks and collisions.
create or replace function public.saeiv_propose_service_change(
 p_driver uuid,p_date date,p_remove_id text,p_replacement jsonb,p_reason text,p_service_items jsonb
) returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare change_id uuid; original jsonb; before_core jsonb; after_core jsonb;
begin
 if jsonb_typeof(p_service_items)<>'array' or jsonb_array_length(p_service_items)>500 then
  raise exception 'Planning recalculé invalide';end if;
 if exists(select 1 from jsonb_array_elements(p_service_items) x
   where x->>'source'='saeiv_estimated_service' and
   (x->>'type' not in ('start','end','hlp','cut','pause')
    or coalesce(x->>'start','') !~ '^[0-2][0-9]:[0-5][0-9]$'
    or coalesce(x->>'end','') !~ '^[0-2][0-9]:[0-5][0-9]$')) then
   raise exception 'Éléments de service estimés incomplets';end if;
 -- The original operation checks the official snapshot, target availability, HLP/overlap,
 -- authorization and held lock, and creates a pending consent request atomically.
 change_id=public.saeiv_propose_segment_change(p_driver,p_date,p_remove_id,p_replacement,p_reason);
 select proposed_items into original from public.saeiv_change_requests where id=change_id for update;
 select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb) into before_core
 from jsonb_array_elements(original) e(value) where value->>'source' is distinct from 'saeiv_estimated_service';
 select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb) into after_core
 from jsonb_array_elements(p_service_items) e(value) where value->>'source' is distinct from 'saeiv_estimated_service';
 if before_core is distinct from after_core then
  raise exception 'Recalcul HLP rejeté : les courses communiquées et proposées ont changé. Recharger le planning.';end if;
 update public.saeiv_change_requests set proposed_items=p_service_items where id=change_id;
 return change_id;
end $$;
revoke all on function public.saeiv_propose_service_change(uuid,date,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.saeiv_propose_service_change(uuid,date,text,jsonb,text,jsonb) to authenticated;
