-- SAEIV 1.0.100 — minimal server-side publication preflight.
-- Not a full regulatory RSE certification; blocks missing basic service structure
-- and seven consecutive worked days even if clients bypass the friendly UI.
create or replace function private.saeiv_preflight_week_rest(
 p_org uuid,p_driver uuid,p_date date,p_items jsonb
) returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare d date; i integer; itemset jsonb; work_dates date[]:=array[]::date[];
begin
 if jsonb_typeof(p_items)<>'array' then raise exception 'Planning incomplet';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'type' in ('regular','school','tad','annex','other')) then
  if not exists(select 1 from jsonb_array_elements(p_items) x where x->>'type'='start')
    or not exists(select 1 from jsonb_array_elements(p_items) x where x->>'type'='end') then
    raise exception 'Prise et fin de service obligatoires avant validation';end if;
 end if;
 for d in select generate_series(p_date-6,p_date+6,interval '1 day')::date loop
  itemset=null;
  if d=p_date then itemset=p_items;
  else
   select items into itemset from public.saeiv_published_days where organization_id=p_org and driver_user_id=p_driver and service_date=d;
   if not found then
    select items into itemset from public.saeiv_planning_days where organization_id=p_org and driver_user_id=p_driver and service_date=d;
   end if;
  end if;
  if jsonb_typeof(itemset)='array' and exists(
   select 1 from jsonb_array_elements(itemset) x where x->>'type' in ('regular','school','tad','annex','other')
  ) then work_dates=array_append(work_dates,d);end if;
 end loop;
 for i in 1..greatest(0,coalesce(array_length(work_dates,1),0)-6) loop
  if work_dates[i+6]=work_dates[i]+6 then
   raise exception 'Repos hebdomadaire à corriger : au moins sept jours travaillés consécutifs';end if;
 end loop;
end $$;
revoke all on function private.saeiv_preflight_week_rest(uuid,uuid,date,jsonb) from public,anon,authenticated;

create or replace function public.saeiv_validate_day(p_day uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare r public.saeiv_planning_days%rowtype;
begin
 select * into r from public.saeiv_planning_days where id=p_day for update;
 if not found or not private.is_exploitation_for(r.organization_id) then raise exception 'Planning non autorisé';end if;
 if r.status<>'draft' then raise exception 'Seul un brouillon peut être validé';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=r.organization_id and owner_id=auth.uid() and r.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 perform private.saeiv_preflight_week_rest(r.organization_id,r.driver_user_id,r.service_date,r.items);
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
 perform private.saeiv_preflight_week_rest(r.organization_id,r.driver_user_id,r.service_date,r.items);
 insert into public.saeiv_published_days(organization_id,driver_user_id,service_date,items,published_by)
 values(r.organization_id,r.driver_user_id,r.service_date,r.items,auth.uid());
 update public.saeiv_planning_days set status='published',updated_by=auth.uid() where id=p_day;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,new_items,actor_id)
 values(r.organization_id,r.driver_user_id,r.service_date,'first_publication',r.items,auth.uid());
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(r.organization_id,r.driver_user_id,'planning_published','Nouveau planning', 'Votre planning du '||to_char(r.service_date,'DD/MM/YYYY')||' est disponible.');
 return true;
end $$;
