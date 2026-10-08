-- Mon SAEIV 1.0.92 - unique matricule sequence compatible with existing profiles.
create or replace function public.saeiv_next_matricule(p_depot uuid)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare org uuid; company_code text; depot_code text; seq bigint; candidate text;
begin
 org=private.current_org_id();
 if org is null or private.current_app_role()<>'admin'::public.app_role then raise exception 'Réservé à l’administrateur';end if;
 select upper(left(regexp_replace(code::text,'[^[:alnum:]]','','g'),1)) into company_code
   from public.organizations where id=org;
 select upper(left(regexp_replace(code::text,'[^[:alnum:]]','','g'),2)) into depot_code
   from public.depots where id=p_depot and organization_id=org and active;
 if company_code is null or depot_code is null or length(depot_code)<2 then raise exception 'Code entreprise/dépôt invalide';end if;
 loop
  insert into public.saeiv_matricule_sequences(organization_id,depot_id,last_number) values(org,p_depot,1)
   on conflict(organization_id,depot_id) do update set last_number=public.saeiv_matricule_sequences.last_number+1
   returning last_number into seq;
  candidate=company_code||depot_code||lpad(seq::text,3,'0');
  exit when not exists(select 1 from public.profiles where organization_id=org and matricule::text=candidate);
 end loop;
 return candidate;
end $$;
revoke all on function public.saeiv_next_matricule(uuid) from public,anon;
grant execute on function public.saeiv_next_matricule(uuid) to authenticated;
