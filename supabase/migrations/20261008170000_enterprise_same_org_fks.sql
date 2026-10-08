-- Additive tenant-integrity constraints for SAEIV v1.0.92
alter table public.profiles add constraint saeiv_profile_org_user_unique unique (organization_id, user_id);
alter table public.saeiv_planning_days add constraint saeiv_days_driver_same_org foreign key (organization_id,driver_user_id) references public.profiles(organization_id,user_id);
alter table public.saeiv_published_days add constraint saeiv_published_driver_same_org foreign key (organization_id,driver_user_id) references public.profiles(organization_id,user_id);
alter table public.saeiv_change_requests add constraint saeiv_changes_driver_same_org foreign key (organization_id,driver_user_id) references public.profiles(organization_id,user_id);
alter table public.saeiv_driver_secondary_depots add constraint saeiv_secondary_driver_same_org foreign key (organization_id,driver_user_id) references public.profiles(organization_id,user_id);
alter table public.saeiv_driver_line_skills add constraint saeiv_skills_driver_same_org foreign key (organization_id,driver_user_id) references public.profiles(organization_id,user_id);