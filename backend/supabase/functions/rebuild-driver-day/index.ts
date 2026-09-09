// Mon SAEIV — Supabase Edge Function
// Reconstruit les HLP automatiques d'un conducteur pour une journée.
// AUCUNE marge n'est ajoutée au temps routier.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Point = { lat:number; lon:number; name?:string };

type PlanItem = {
  id:string;
  organization_id:string;
  driver_user_id:string;
  service_date:string;
  sort_index:number;
  type:string;
  start_time:string|null;
  end_time:string|null;
  origin:string|null;
  destination:string|null;
  origin_coords:Point|null;
  destination_coords:Point|null;
};

const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const json = (body:unknown, status=200) => new Response(JSON.stringify(body), {
  status,
  headers:{...cors,'Content-Type':'application/json; charset=utf-8'}
});

function timeToMinutes(value:string|null|undefined){
  if(!value)return null;
  const m=String(value).match(/^(\d{1,2}):(\d{2})/);
  if(!m)return null;
  return Number(m[1])*60+Number(m[2]);
}

function minutesToTime(total:number){
  const n=((Math.round(total)%1440)+1440)%1440;
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}:00`;
}

function validPoint(p:unknown):p is Point{
  const x=p as Point;
  return !!x && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lon));
}

function haversine(a:Point,b:Point){
  const R=6371000, r=(x:number)=>x*Math.PI/180;
  const dLat=r(b.lat-a.lat),dLon=r(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

async function routeEstimate(a:Point,b:Point){
  const base=Deno.env.get('ROUTING_BASE_URL')||'https://router.project-osrm.org';
  const url=`${base.replace(/\/$/,'')}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=false&alternatives=false`;
  const r=await fetch(url,{headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`Routage HTTP ${r.status}`);
  const data=await r.json();
  const route=data?.routes?.[0];
  if(!route||!Number.isFinite(Number(route.duration)))throw new Error('Aucun itinéraire routier trouvé');
  return {seconds:Number(route.duration),meters:Number(route.distance)||0};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Méthode non autorisée'},405);

  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service)return json({error:'Configuration Supabase incomplète'},500);

    const authHeader=req.headers.get('Authorization')||'';
    if(!authHeader.startsWith('Bearer '))return json({error:'Authentification requise'},401);

    const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
    const admin=createClient(url,service,{auth:{persistSession:false}});

    const {data:{user},error:userError}=await caller.auth.getUser();
    if(userError||!user)return json({error:'Session invalide'},401);

    const body=await req.json().catch(()=>({}));
    const driverUserId=String(body.driverUserId||'');
    const serviceDate=String(body.serviceDate||'');
    if(!driverUserId||!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate))return json({error:'driverUserId et serviceDate requis'},400);

    const {data:callerProfile}=await caller.from('profiles').select('organization_id,role,active').eq('user_id',user.id).maybeSingle();
    if(!callerProfile?.active||!['dispatcher','admin'].includes(callerProfile.role))return json({error:'Accès exploitation requis'},403);

    const {data:driverProfile}=await caller.from('profiles').select('organization_id,active,display_name,matricule').eq('user_id',driverUserId).maybeSingle();
    if(!driverProfile?.active||driverProfile.organization_id!==callerProfile.organization_id)return json({error:'Conducteur hors de votre société'},403);

    // Supprime uniquement les HLP précédemment générés automatiquement.
    const {error:deleteError}=await admin.from('plan_items')
      .delete()
      .eq('driver_user_id',driverUserId)
      .eq('service_date',serviceDate)
      .eq('source','auto_hlp');
    if(deleteError)throw deleteError;

    const {data:items,error:itemsError}=await admin.from('plan_items')
      .select('id,organization_id,driver_user_id,service_date,sort_index,type,start_time,end_time,origin,destination,origin_coords,destination_coords')
      .eq('driver_user_id',driverUserId)
      .eq('service_date',serviceDate)
      .neq('source','auto_hlp')
      .order('start_time',{ascending:true,nullsFirst:false})
      .order('sort_index',{ascending:true});
    if(itemsError)throw itemsError;

    const xs=(items||[]) as PlanItem[];
    const generated:any[]=[];
    const warnings:any[]=[];

    for(let i=0;i<xs.length-1;i++){
      const prev=xs[i],next=xs[i+1];
      if(!validPoint(prev.destination_coords)||!validPoint(next.origin_coords))continue;

      // Même lieu (moins de 120 m) : pas de HLP à créer.
      if(haversine(prev.destination_coords,next.origin_coords)<120)continue;

      let route;
      try{ route=await routeEstimate(prev.destination_coords,next.origin_coords); }
      catch(e){
        warnings.push({previousId:prev.id,nextId:next.id,error:String(e?.message||e)});
        continue;
      }

      const durationMinutes=Math.max(1,Math.round(route.seconds/60)); // aucune marge
      const km=route.meters/1000;
      let prevEnd=timeToMinutes(prev.end_time);
      let nextStart=timeToMinutes(next.start_time);
      if(prevEnd===null&&nextStart===null)continue;

      // Les services peuvent dépasser minuit : on remet les heures dans un même axe temporel.
      if(prevEnd!==null&&nextStart!==null&&nextStart<prevEnd)nextStart+=1440;

      let hlpStart:number,hlpEnd:number;
      if(nextStart!==null){
        hlpEnd=nextStart;
        hlpStart=hlpEnd-durationMinutes;
      }else{
        hlpStart=prevEnd!;
        hlpEnd=hlpStart+durationMinutes;
      }

      const conflictMinutes=prevEnd!==null?Math.max(0,prevEnd-hlpStart):0;
      const status=conflictMinutes>0?'conflict':'ok';
      const origin=prev.destination||prev.destination_coords.name||'Fin activité précédente';
      const destination=next.origin||next.origin_coords.name||'Départ activité suivante';

      generated.push({
        organization_id:callerProfile.organization_id,
        driver_user_id:driverUserId,
        service_date:serviceDate,
        sort_index:Number(prev.sort_index||0)+1,
        type:'hlp',
        label:`HLP automatique · ${origin} → ${destination}`,
        start_time:minutesToTime(hlpStart),
        end_time:minutesToTime(hlpEnd),
        origin,
        destination,
        origin_coords:prev.destination_coords,
        destination_coords:next.origin_coords,
        origin_kind:'auto',
        destination_kind:'auto',
        line_distance_km:Number(km.toFixed(2)),
        drive_minutes:durationMinutes,
        notes:conflictMinutes>0
          ? `Conflit planning : ${conflictMinutes} min manquantes pour effectuer ce HLP.`
          : 'HLP calculé automatiquement entre deux activités. Aucune marge ajoutée.',
        linked:{auto:true,routing:'road',margin_minutes:0},
        source:'auto_hlp',
        locked_by_exploitation:true,
        status,
        conflict_minutes:conflictMinutes,
        generated_from_prev:prev.id,
        generated_from_next:next.id,
        created_by:user.id,
        updated_by:user.id
      });
    }

    if(generated.length){
      const {error:insertError}=await admin.from('plan_items').insert(generated);
      if(insertError)throw insertError;
    }

    return json({
      ok:true,
      driver:{userId:driverUserId,matricule:driverProfile.matricule,displayName:driverProfile.display_name},
      serviceDate,
      generated:generated.length,
      conflicts:generated.filter(x=>x.status==='conflict').map(x=>({
        from:x.origin,to:x.destination,missingMinutes:x.conflict_minutes,start:x.start_time,end:x.end_time
      })),
      warnings
    });
  }catch(e){
    console.error(e);
    return json({error:String(e?.message||e)},500);
  }
});
