-- Data-only import based on three supplied René Antoni Toussaint service sheets (2026).
-- GTFS route_short_name and route_id independently verified in fluo54_core.json/fluo57_core.json.
-- Service trip numbers, drivers and TAD variants have intentionally NOT been mistaken for new lines.
-- Effective registration date is 2026-10-09; this is an operator roster,
-- not proof that every run on these routes is operated by René Antoni year-round.
DO $$
DECLARE target_org uuid;
BEGIN
 SELECT id INTO STRICT target_org FROM public.organizations WHERE code='PILOTE';
 -- Preserve existing organization UUID, memberships and test drivers.
 UPDATE public.organizations
 SET name='Transports René Antoni (SAEIV pilote)',updated_at=now()
 WHERE id=target_org AND name='Société pilote SAEIV';

 INSERT INTO public.saeiv_company_lines
   (organization_id,network,department,line_code,gtfs_route_id,start_date,end_date,active)
 SELECT target_org,'fluo',v.department,v.line_code,v.gtfs_route_id,'2026-10-09'::date,null,true
 FROM (VALUES
      ('57','57R026','1006672'),
      ('57','57R027','1006282'),
      ('57','57R028','1006673'),
      ('57','57R033','1006677'),
      ('57','57R041','1006683'),
      ('57','57R166','1006717'),
      ('54','54R330','1004062'),
      ('54','54R340','1004788'),
      ('54','54R350','1004063'),
      ('54','54R360','1004064'),
      ('54','54R370','1004789'),
      ('54','54R380','1004066')
 ) AS v(department,line_code,gtfs_route_id)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.saeiv_company_lines l
   WHERE l.organization_id=target_org AND l.department=v.department
     AND upper(replace(l.line_code,' ',''))=v.line_code
 );
END $$;
