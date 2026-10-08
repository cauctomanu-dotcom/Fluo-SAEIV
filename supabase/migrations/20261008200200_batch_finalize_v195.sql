-- All approvals are mandatory; this one transaction publishes all drivers or none.
create or replace function public.saeiv_finalize_change_batch(p_batch uuid)
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare g public.saeiv_change_batches%rowtype; r public.saeiv_change_requests%rowtype;
 official public.saeiv_published_days%rowtype; n integer:=0;
begin
 select * into g from public.saeiv_change_batches where id=p_batch for update;
 if not found or not private.is_exploitation_for(g.organization_id) then raise exception 'Groupe non autorisé';end if;
 if g.status<>'pending' then raise exception 'Groupe refusé, annulé ou déjà publié';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=g.organization_id and owner_id=auth.uid() and g.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou du planning requis';end if;
 if exists(select 1 from public.saeiv_change_requests where batch_id=p_batch and status<>'accepted') then
  raise exception 'En attente de l’accord de tous les conducteurs. Un refus bloque le groupe';
 end if;
 if (select count(*) from public.saeiv_change_requests where batch_id=p_batch)<2 then raise exception 'Groupe incomplet';end if;
 for r in select * from public.saeiv_change_requests where batch_id=p_batch order by driver_user_id for update loop
  select * into official from public.saeiv_published_days
  where organization_id=g.organization_id and driver_user_id=r.driver_user_id and service_date=g.service_date for update;
  if not found or official.revision<>r.base_revision then raise exception 'Version du planning périmée pour %',r.driver_user_id;end if;
  if r.response_exempt and (g.sick_driver_user_id is distinct from r.driver_user_id or not exists(
    select 1 from public.driver_unavailability u where u.organization_id=g.organization_id and u.driver_user_id=r.driver_user_id and u.service_date=g.service_date and u.kind='sick'
  )) then raise exception 'Exemption pour arrêt non valide';end if;
 end loop;
 for r in select * from public.saeiv_change_requests where batch_id=p_batch order by driver_user_id for update loop
  update public.saeiv_published_days set items=r.proposed_items,revision=revision+1,published_at=now(),published_by=auth.uid()
  where organization_id=g.organization_id and driver_user_id=r.driver_user_id and service_date=g.service_date;
  update public.saeiv_change_requests set status='published',finalized_by=auth.uid(),finalized_at=now(),published_at=now() where id=r.id;
  insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id,details)
  values(g.organization_id,r.driver_user_id,g.service_date,'batch_change_published',r.previous_items,r.proposed_items,auth.uid(),r.id,jsonb_build_object('batch_id',p_batch));
  insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message,payload)
  values(g.organization_id,r.driver_user_id,'change_published','Planning modifié','Votre planning du '||to_char(g.service_date,'DD/MM/YYYY')||' a été republié après les validations.',jsonb_build_object('batch_id',p_batch));
  n=n+1;
 end loop;
 update public.saeiv_change_batches set status='published',finalized_at=now(),finalized_by=auth.uid() where id=p_batch;
 return n;
end $$;
create or replace function public.saeiv_cancel_change_batch(p_batch uuid)
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare g public.saeiv_change_batches%rowtype; n integer;
begin
 select * into g from public.saeiv_change_batches where id=p_batch for update;
 if not found or not private.is_exploitation_for(g.organization_id) or g.status not in ('pending','refused') then raise exception 'Annulation interdite';end if;
 update public.saeiv_change_requests set status='cancelled' where batch_id=p_batch and status in ('pending','accepted','refused');
 get diagnostics n=row_count;
 update public.saeiv_change_batches set status='cancelled' where id=p_batch;
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message,payload)
 select g.organization_id,c.driver_user_id,'change_cancelled','Modification annulée','La modification groupée de votre planning a été annulée.',jsonb_build_object('batch_id',p_batch)
 from public.saeiv_change_requests c where c.batch_id=p_batch;
 return n;
end $$;
create or replace function public.saeiv_batch_refusal_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.batch_id is not null and new.status='refused' and old.status is distinct from 'refused' then
  update public.saeiv_change_batches set status='refused' where id=new.batch_id and status='pending';
 end if;
 return new;
end $$;
drop trigger if exists saeiv_batch_refusal on public.saeiv_change_requests;
create trigger saeiv_batch_refusal after update of status on public.saeiv_change_requests
for each row execute function public.saeiv_batch_refusal_guard();
revoke all on function public.saeiv_finalize_change_batch(uuid),public.saeiv_cancel_change_batch(uuid) from public,anon;
grant execute on function public.saeiv_finalize_change_batch(uuid),public.saeiv_cancel_change_batch(uuid) to authenticated;
