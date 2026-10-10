-- Mon SAEIV shared exploitation: targeted direct operational messages.
-- The existing saeiv_notifications table, RLS self-read / self-update policies
-- and Realtime publication remain unchanged.
-- Dispatcher/admin can only send to ACTIVE drivers of THEIR OWN organization.
begin;
do $$
begin
 if not exists (
   select 1 from pg_policies
   where schemaname='public'
   and tablename='saeiv_notifications'
   and policyname='saeiv_notifications_dispatch_direct_insert'
 ) then
  execute $policy$
   create policy saeiv_notifications_dispatch_direct_insert
   on public.saeiv_notifications for insert to authenticated
   with check (
     kind='dispatch_direct'
     and private.is_exploitation_for(organization_id)
     and char_length(title) between 1 and 90
     and char_length(message) between 1 and 800
     and read_at is null
     and exists (
       select 1 from public.profiles p
       where p.user_id=recipient_user_id
         and p.organization_id=saeiv_notifications.organization_id
         and p.role='driver' and p.active
     )
   )
  $policy$;
 end if;
end $$;
grant insert on public.saeiv_notifications to authenticated;
commit;
