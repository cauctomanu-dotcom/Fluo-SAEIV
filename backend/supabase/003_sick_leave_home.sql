-- Mon SAEIV — arrêt maladie réversible + domicile conducteur pour les coupures
-- Migration idempotente correspondant au schéma de production.

alter table public.driver_settings add column if not exists home_location jsonb;
alter table public.driver_settings add column if not exists home_minimum_stay_minutes integer not null default 30;
do $$ begin
  alter table public.driver_settings add constraint driver_settings_home_minimum_stay_minutes_check check (home_minimum_stay_minutes between 0 and 240);
exception when duplicate_object then null;
end $$;

alter table public.driver_unavailability add column if not exists sick_leave_group_id uuid;
alter table public.planning_reassignment_queue add column if not exists sick_leave_group_id uuid;
create index if not exists driver_unavailability_sick_group_idx on public.driver_unavailability(sick_leave_group_id) where kind='sick';
create index if not exists planning_reassignment_sick_group_idx on public.planning_reassignment_queue(sick_leave_group_id);

create or replace function public.register_sick_leave(
  p_organization_id uuid,
  p_driver_user_id uuid,
  p_from date,
  p_to date,
  p_reason text default 'Arrêt maladie'
) returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  displaced_count integer := 0;
  day_count integer := 0;
  caller_id uuid := auth.uid();
  d date;
  group_id uuid := gen_random_uuid();
begin
  if caller_id is null then raise exception 'Authentification requise'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Période d’arrêt maladie invalide'; end if;
  if not private.is_exploitation_for(p_organization_id) then raise exception 'Accès exploitation requis'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.user_id=p_driver_user_id and p.organization_id=p_organization_id and p.role='driver' and p.active=true
  ) then raise exception 'Conducteur inconnu ou inactif'; end if;

  insert into public.planning_reassignment_queue(
    organization_id,service_date,original_driver_user_id,original_plan_item_id,
    segment_id,line,start_time,end_time,course_snapshot,status,created_by,sick_leave_group_id
  )
  select p.organization_id,p.service_date,p.driver_user_id,p.id,
         coalesce(p.payload->>'segment_id',p.id::text),p.line,p.start_time,p.end_time,
         to_jsonb(p),'pending',caller_id,group_id
  from public.plan_items p
  where p.organization_id=p_organization_id
    and p.driver_user_id=p_driver_user_id
    and p.service_date between p_from and p_to
    and p.type in ('regular','school','tad','annex','other')
    and not exists (
      select 1 from public.planning_reassignment_queue q
      where q.organization_id=p.organization_id and q.original_plan_item_id=p.id and q.status <> 'cancelled'
    );
  get diagnostics displaced_count = row_count;

  delete from public.plan_items p
  where p.organization_id=p_organization_id
    and p.driver_user_id=p_driver_user_id
    and p.service_date between p_from and p_to
    and (p.type in ('regular','school','tad','annex','other') or p.source::text in ('auto_hlp','auto_cut','auto_service'));

  for d in select generate_series(p_from,p_to,interval '1 day')::date loop
    insert into public.driver_unavailability(
      organization_id,driver_user_id,service_date,start_time,end_time,reason,kind,created_by,sick_leave_group_id
    )
    select p_organization_id,p_driver_user_id,d,'00:00:00'::time,'23:59:59'::time,
           coalesce(nullif(trim(p_reason),''),'Arrêt maladie'),'sick',caller_id,group_id
    where not exists (
      select 1 from public.driver_unavailability u
      where u.organization_id=p_organization_id and u.driver_user_id=p_driver_user_id and u.service_date=d and u.kind='sick'
    );
    if found then day_count := day_count + 1; end if;
  end loop;

  return jsonb_build_object('ok',true,'sickLeaveGroupId',group_id,'driverUserId',p_driver_user_id,
    'from',p_from,'to',p_to,'days',day_count,'displacedCourses',displaced_count);
end;
$$;

create or replace function public.cancel_sick_leave(p_unavailability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_id uuid := auth.uid();
  target public.driver_unavailability%rowtype;
  q public.planning_reassignment_queue%rowtype;
  restored_count integer := 0;
  removed_reassigned_count integer := 0;
  deleted_now integer := 0;
  absence_days integer := 0;
  affected jsonb := '[]'::jsonb;
  restored_id uuid;
begin
  if caller_id is null then raise exception 'Authentification requise'; end if;
  select * into target from public.driver_unavailability where id=p_unavailability_id and kind='sick';
  if target.id is null then raise exception 'Arrêt maladie introuvable'; end if;
  if not private.is_exploitation_for(target.organization_id) then raise exception 'Accès exploitation requis'; end if;

  for q in
    select * from public.planning_reassignment_queue x
    where x.organization_id=target.organization_id
      and x.original_driver_user_id=target.driver_user_id
      and x.status <> 'cancelled'
      and (
        (target.sick_leave_group_id is not null and x.sick_leave_group_id=target.sick_leave_group_id)
        or
        (target.sick_leave_group_id is null and x.sick_leave_group_id is null and x.service_date in (
          select u.service_date from public.driver_unavailability u
          where u.organization_id=target.organization_id and u.driver_user_id=target.driver_user_id
            and u.kind='sick' and u.sick_leave_group_id is null and u.created_at=target.created_at
        ))
      )
    order by x.service_date,x.start_time
  loop
    if q.assigned_driver_user_id is not null then
      affected := affected || jsonb_build_array(jsonb_build_object('driverUserId',q.assigned_driver_user_id,'serviceDate',q.service_date));
    end if;

    delete from public.plan_items p
    where p.organization_id=q.organization_id and p.service_date=q.service_date
      and ((p.payload->>'reassignment_queue_id')=q.id::text or (p.linked->>'reassignment_queue_id')=q.id::text);
    get diagnostics deleted_now = row_count;
    removed_reassigned_count := removed_reassigned_count + deleted_now;

    if not exists (
      select 1 from public.plan_items p
      where p.organization_id=q.organization_id and p.driver_user_id=q.original_driver_user_id and p.service_date=q.service_date
        and (p.id=q.original_plan_item_id or (q.segment_id is not null and p.payload->>'segment_id'=q.segment_id))
    ) then
      restored_id := coalesce(nullif(q.course_snapshot->>'id','')::uuid,q.original_plan_item_id,gen_random_uuid());
      insert into public.plan_items(
        id,organization_id,driver_user_id,client_id,service_date,sort_index,type,label,line,start_time,end_time,
        origin,destination,origin_coords,destination_coords,origin_kind,destination_kind,regime,line_distance_km,
        drive_minutes,notes,linked,source,locked_by_exploitation,status,conflict_minutes,generated_from_prev,
        generated_from_next,created_by,updated_by,revision,created_at,updated_at,payload
      ) values (
        restored_id,q.organization_id,q.original_driver_user_id,q.course_snapshot->>'client_id',q.service_date,
        coalesce(nullif(q.course_snapshot->>'sort_index','')::integer,0),coalesce(q.course_snapshot->>'type','regular'),
        q.course_snapshot->>'label',q.course_snapshot->>'line',nullif(q.course_snapshot->>'start_time','')::time,
        nullif(q.course_snapshot->>'end_time','')::time,q.course_snapshot->>'origin',q.course_snapshot->>'destination',
        q.course_snapshot->'origin_coords',q.course_snapshot->'destination_coords',q.course_snapshot->>'origin_kind',
        q.course_snapshot->>'destination_kind',q.course_snapshot->>'regime',nullif(q.course_snapshot->>'line_distance_km','')::numeric,
        nullif(q.course_snapshot->>'drive_minutes','')::integer,q.course_snapshot->>'notes',q.course_snapshot->'linked',
        coalesce(nullif(q.course_snapshot->>'source','')::public.plan_source,'dispatch'::public.plan_source),
        coalesce(nullif(q.course_snapshot->>'locked_by_exploitation','')::boolean,true),coalesce(q.course_snapshot->>'status','ok'),
        coalesce(nullif(q.course_snapshot->>'conflict_minutes','')::integer,0),nullif(q.course_snapshot->>'generated_from_prev','')::uuid,
        nullif(q.course_snapshot->>'generated_from_next','')::uuid,nullif(q.course_snapshot->>'created_by','')::uuid,caller_id,
        coalesce(nullif(q.course_snapshot->>'revision','')::bigint,1),coalesce(nullif(q.course_snapshot->>'created_at','')::timestamptz,now()),
        now(),coalesce(q.course_snapshot->'payload','{}'::jsonb)
      );
      restored_count := restored_count + 1;
    end if;

    update public.planning_reassignment_queue
    set status='cancelled',assigned_driver_user_id=null,result_reason='Arrêt maladie annulé par l’exploitation',placed_at=null,updated_at=now()
    where id=q.id;
    affected := affected || jsonb_build_array(jsonb_build_object('driverUserId',q.original_driver_user_id,'serviceDate',q.service_date));
  end loop;

  if target.sick_leave_group_id is not null then
    delete from public.driver_unavailability
    where organization_id=target.organization_id and sick_leave_group_id=target.sick_leave_group_id and kind='sick';
  else
    delete from public.driver_unavailability
    where organization_id=target.organization_id and driver_user_id=target.driver_user_id and kind='sick'
      and sick_leave_group_id is null and created_at=target.created_at;
  end if;
  get diagnostics absence_days = row_count;

  return jsonb_build_object('ok',true,'driverUserId',target.driver_user_id,'absenceDaysRemoved',absence_days,
    'restoredCourses',restored_count,'removedReassignedCourses',removed_reassigned_count,'affected',affected);
end;
$$;

revoke execute on function public.register_sick_leave(uuid,uuid,date,date,text) from public, anon;
revoke execute on function public.cancel_sick_leave(uuid) from public, anon;
grant execute on function public.register_sick_leave(uuid,uuid,date,date,text) to authenticated;
grant execute on function public.cancel_sick_leave(uuid) to authenticated;

-- Les RPC d'exploitation historiques ne doivent jamais être appelables anonymement.
revoke execute on function public.delete_test_driver(uuid) from public, anon;
grant execute on function public.delete_test_driver(uuid) to authenticated;
revoke execute on function public.apply_cut_override_before_insert() from public, anon, authenticated;
