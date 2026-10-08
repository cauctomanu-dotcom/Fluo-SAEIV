-- Existing single-driver finalization/cancellation cannot bypass the group-wide approval gate.
create or replace function public.saeiv_cancel_change(p_change uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype;
begin
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or x.batch_id is not null or not private.is_exploitation_for(x.organization_id) or x.status not in ('pending','accepted') then raise exception 'Proposition non annulable';end if;
 update public.saeiv_change_requests set status='cancelled' where id=p_change;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(x.organization_id,x.driver_user_id,x.service_date,'change_cancelled',x.previous_items,x.proposed_items,auth.uid(),p_change);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(x.organization_id,x.driver_user_id,'change_cancelled','Modification annulée','La proposition de changement a été retirée par exploitation.');
 return true;
end $$;

create or replace function public.saeiv_finalize_change(p_change uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare x public.saeiv_change_requests%rowtype; official public.saeiv_published_days%rowtype;
begin
 select * into x from public.saeiv_change_requests where id=p_change for update;
 if not found or x.batch_id is not null or not private.is_exploitation_for(x.organization_id) or x.status<>'accepted' then raise exception 'Seule une proposition acceptée peut être publiée par exploitation';end if;
 if not exists(select 1 from public.saeiv_planning_locks where organization_id=x.organization_id and owner_id=auth.uid() and x.service_date between start_date and end_date and expires_at>now()) then raise exception 'Verrou requis';end if;
 select * into official from public.saeiv_published_days where organization_id=x.organization_id and driver_user_id=x.driver_user_id and service_date=x.service_date for update;
 if not found or official.revision<>x.base_revision then raise exception 'Le planning officiel a changé entre-temps; recréer la proposition';end if;
 update public.saeiv_published_days set items=x.proposed_items,revision=revision+1,published_at=now(),published_by=auth.uid() where id=official.id;
 update public.saeiv_change_requests set status='published',finalized_by=auth.uid(),finalized_at=now(),published_at=now() where id=p_change;
 insert into public.saeiv_planning_audit(organization_id,driver_user_id,service_date,event,old_items,new_items,actor_id,change_id)
 values(x.organization_id,x.driver_user_id,x.service_date,'change_published',x.previous_items,x.proposed_items,auth.uid(),p_change);
 insert into public.saeiv_notifications(organization_id,recipient_user_id,kind,title,message)
 values(x.organization_id,x.driver_user_id,'change_published','Planning modifié','Votre planning du '||to_char(x.service_date,'DD/MM/YYYY')||' a été mis à jour après votre accord.');
 return true;
end $$;


