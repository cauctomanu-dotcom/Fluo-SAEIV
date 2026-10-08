create or replace function public.saeiv_assign_test_drivers(p_driver_ids uuid[],p_depot_id uuid)
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare own_org uuid; total integer;
begin
 own_org=private.current_org_id();
 if own_org is null or private.current_app_role()<>'admin'::public.app_role then raise exception 'Administrateur local requis';end if;
 if not exists(select 1 from public.depots where id=p_depot_id and organization_id=own_org and active) then raise exception 'Dépôt non autorisé';end if;
 if coalesce(array_length(p_driver_ids,1),0)>150 then raise exception 'Maximum 150 conducteurs';end if;
 update public.profiles set depot_id=p_depot_id,updated_at=now()
 where user_id=any(p_driver_ids) and organization_id=own_org and role='driver' and is_test_driver=true;
 get diagnostics total=row_count;return total;
end $$;
revoke all on function public.saeiv_assign_test_drivers(uuid[],uuid) from public,anon;
grant execute on function public.saeiv_assign_test_drivers(uuid[],uuid) to authenticated;