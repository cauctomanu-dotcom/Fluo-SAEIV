-- SAEIV 1.0.96: prepare consent-based edit from a legacy already-visible driver plan or an official day.
-- RPC leaves both plan_items and official schedule intact while awaiting consent.
create or replace function public.saeiv_propose_segment_change(
 p_driver uuid,p_date date,p_remove_id text,p_replacement jsonb,p_reason text
) returns uuid language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare o uuid; current_plan public.saeiv_published_days%rowtype;
 legacy jsonb; old_items jsonb; new_items jsonb; old_item jsonb; key_id text; result_id uuid; candidate jsonb;
begin
 o=private.current_org_id();
 if o is null or not private.is_exploitation_for(o) then raise exception 'Accès exploitation requis';end if;
 if p_driver is null or p_date is null or nullif(trim(coalesce(p_remove_id,'')),'') is null
    or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Conducteur, date, segment et motif obligatoires';end if;
 if not exists(select 1 from public.profiles where organization_id=o and user_id=p_driver and role='driver') then raise exception 'Conducteur hors entreprise';end if;
 if not exists(select 1 from public.saeiv_planning_locks
    where organization_id=o and owner_id=auth.uid() and p_date between start_date and end_date and expires_at>now()) then
   raise exception 'Verrou du planning nécessaire';end if;
 select * into current_plan from public.saeiv_published_days
 where organization_id=o and driver_user_id=p_driver and service_date=p_date for update;
 if not found then
  select jsonb_agg(
    jsonb_build_object('id',coalesce(p.client_id,p.id::text),'legacy_item_id',p.id::text,
      'segment_id',p.payload->>'segment_id','date',p.service_date,'type',p.type,
      'line',coalesce(p.line,''),'label',coalesce(p.label,''),'start',left(coalesce(p.start_time::text,''),5),
      'end',left(coalesce(p.end_time::text,''),5),'origin',coalesce(p.origin,''),
      'destination',coalesce(p.destination,''),'originCoords',p.origin_coords,
      'destinationCoords',p.destination_coords,'linked',coalesce(p.linked,'{}'::jsonb),
      'notes',coalesce(p.notes,''),'source',p.source::text) order by p.start_time,p.sort_index
   ) into legacy from public.plan_items p
   where p.organization_id=o and p.driver_user_id=p_driver and p.service_date=p_date;
  if legacy is null then raise exception 'Aucun planning de référence pour ce conducteur et cette date';end if;
  insert into public.saeiv_published_days(organization_id,driver_user_id,service_date,items,published_by)
  values(o,p_driver,p_date,legacy,auth.uid())
  returning * into current_plan;
  insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,new_items,actor_id)
  values(o,p_driver,p_date,'legacy_published_baseline_imported',legacy,auth.uid());
 end if;
 old_items=current_plan.items;
 select value into old_item from jsonb_array_elements(old_items) as value
 where (value->>'id'=p_remove_id or value->>'legacy_item_id'=p_remove_id) limit 1;
 if old_item is null then raise exception 'La course choisie ne figure pas dans le planning communiqué';end if;
 if old_item->>'type' not in ('regular','school','tad','annex','other') then
   raise exception 'Seules les activités de transport peuvent être remplacées ou supprimées';end if;
 new_items=(select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
 from jsonb_array_elements(old_items) with ordinality a(value,ord)
 where value->>'id' is distinct from old_item->>'id');
 if p_replacement is not null then
   if jsonb_typeof(p_replacement)<>'object' or
      nullif(trim(p_replacement->>'line'),'') is null or
      nullif(trim(p_replacement->>'origin'),'') is null or
      nullif(trim(p_replacement->>'destination'),'') is null or
      nullif(trim(p_replacement->>'segment_id'),'') is null or
      (p_replacement->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
      (p_replacement->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
      (p_replacement->>'start')>=(p_replacement->>'end') then
     raise exception 'Segment de remplacement incomplet ou horaires invalides';end if;
   key_id=p_replacement->>'segment_id';
   if exists(select 1 from public.plan_items p
     where p.organization_id=o and p.service_date=p_date
      and p.driver_user_id<>p_driver and p.payload->>'segment_id'=key_id
      and p.type in ('regular','school','tad')) then
     raise exception 'Cette course est déjà affectée à un autre conducteur';end if;
   if exists(select 1 from public.saeiv_published_days p
     cross join lateral jsonb_array_elements(p.items) a
     where p.organization_id=o and p.service_date=p_date and p.driver_user_id<>p_driver
      and a->>'segment_id'=key_id) then raise exception 'Course déjà présente sur un autre planning officiel';end if;
   if exists(select 1 from public.saeiv_planning_days p
     cross join lateral jsonb_array_elements(p.items) a
     where p.organization_id=o and p.service_date=p_date and p.driver_user_id<>p_driver
      and a->>'segment_id'=key_id) then raise exception 'Course réservée par un brouillon';end if;
   if exists(select 1 from jsonb_array_elements(new_items) a
     where a->>'segment_id'=key_id) then raise exception 'Course déjà présente dans la journée du conducteur';end if;
   if exists(select 1 from jsonb_array_elements(new_items) a where
      a->>'type' in ('regular','school','tad','annex','other')
      and nullif(a->>'start','') is not null and nullif(a->>'end','') is not null
      and a->>'start'<p_replacement->>'end' and a->>'end'>p_replacement->>'start') then
      raise exception 'Chevauchement horaire avec une autre activité';end if;
   candidate=p_replacement||jsonb_build_object('id','replacement-'||key_id,'date',p_date,'type',coalesce(p_replacement->>'type','regular'),'source','dispatch_proposed');
   new_items=new_items||jsonb_build_array(candidate);
 end if;
 -- The existing proposal RPC keeps official data unchanged and sends the driver inbox notification.
 result_id=public.saeiv_propose_change(p_driver,p_date,new_items,p_reason);
 return result_id;
end $$;
revoke all on function public.saeiv_propose_segment_change(uuid,date,text,jsonb,text) from public,anon;
grant execute on function public.saeiv_propose_segment_change(uuid,date,text,jsonb,text) to authenticated;
