-- Atomic proposal: one date, multiple driver revisions, never a direct publication.
create or replace function public.saeiv_propose_change_batch(
 p_date date,p_reason text,p_changes jsonb,p_sick_driver uuid default null
) returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare o uuid; bid uuid; entry jsonb; person uuid; old_day public.saeiv_published_days%rowtype;
 proposed jsonb; exempt boolean; total integer:=0; changed_count integer:=0; already text[]:=array[]::text[];
begin
 o=private.current_org_id();
 if o is null or not private.is_exploitation_for(o) then raise exception 'Exploitation non autorisée';end if;
 if p_date is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Date ou motif incomplet';end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 2 and 120 then raise exception 'Sélectionner 2 à 120 conducteurs concernés';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=o and owner_id=auth.uid() and p_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou du planning requis';end if;
 if p_sick_driver is not null and not exists(
   select 1 from public.driver_unavailability u where u.organization_id=o and u.driver_user_id=p_sick_driver and u.service_date=p_date and u.kind='sick'
 ) then raise exception 'Arrêt de travail non enregistré pour ce conducteur et cette date';end if;
 -- All checks are performed inside the single SQL transaction. Any failure rolls back all proposals.
 for entry in select value from jsonb_array_elements(p_changes) value order by value->>'driver_id' loop
   person=nullif(entry->>'driver_id','')::uuid;
   proposed=entry->'items';
   if person is null or jsonb_typeof(proposed)<>'array' or array_length(already,1)>119 then raise exception 'Élément du groupe invalide';end if;
   if person::text=any(already) then raise exception 'Conducteur présent plusieurs fois dans le lot';end if;
   already=array_append(already,person::text);
   select * into old_day from public.saeiv_published_days
   where organization_id=o and driver_user_id=person and service_date=p_date for update;
   if not found then raise exception 'Planning publié introuvable pour le conducteur %',person;end if;
   if old_day.items=proposed then raise exception 'Proposition identique au planning officiel pour %',person;end if;
   if exists(select 1 from public.saeiv_change_requests where organization_id=o and driver_user_id=person and service_date=p_date and status in ('pending','accepted')) then raise exception 'Une proposition attend déjà pour %',person;end if;
   exempt=p_sick_driver is not null and person=p_sick_driver;
   if exempt then
     if exists(select 1 from jsonb_array_elements(proposed) a where a->>'type' in ('regular','school','tad','annex','other')) then
       raise exception 'Le conducteur en arrêt conserve une course : groupe rejeté';
     end if;
   end if;
   if not exempt then changed_count=changed_count+1;end if;
   total=total+1;
 end loop;
 if p_sick_driver is not null and not p_sick_driver::text=any(already) then raise exception 'Le conducteur absent doit figurer dans la proposition';end if;
 if changed_count=0 then raise exception 'Aucun conducteur destinataire du changement';end if;
 insert into public.saeiv_change_batches(organization_id,service_date,reason,kind,sick_driver_user_id,created_by)
 values(o,p_date,p_reason,case when p_sick_driver is null then 'manual' else 'reassignment' end,p_sick_driver,auth.uid())
 returning id into bid;
 for entry in select value from jsonb_array_elements(p_changes) value order by value->>'driver_id' loop
   person=(entry->>'driver_id')::uuid;proposed=entry->'items';
   exempt=p_sick_driver is not null and person=p_sick_driver;
   select * into old_day from public.saeiv_published_days
   where organization_id=o and driver_user_id=person and service_date=p_date;
   insert into public.saeiv_change_requests(organization_id,driver_user_id,service_date,base_revision,previous_items,proposed_items,summary,created_by,batch_id,response_exempt,status,response_at)
   values(o,person,p_date,old_day.revision,old_day.items,proposed,p_reason,auth.uid(),bid,exempt,
    case when exempt then 'accepted' else 'pending' end,case when exempt then now() else null end);
   insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message,payload)
   values(o,person,case when exempt then 'sick_plan_info' else 'change_proposed' end,
    case when exempt then 'Services retirés pendant votre arrêt' else 'Accord demandé pour votre planning' end,p_reason,
    jsonb_build_object('batch_id',bid));
   insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,details)
   values(o,person,p_date,case when exempt then 'sick_driver_exempt' else 'batch_change_proposed' end,old_day.items,proposed,auth.uid(),jsonb_build_object('batch_id',bid,'exempt',exempt));
 end loop;
 return bid;
end $$;
revoke all on function public.saeiv_propose_change_batch(date,text,jsonb,uuid) from public,anon;
grant execute on function public.saeiv_propose_change_batch(date,text,jsonb,uuid) to authenticated;
