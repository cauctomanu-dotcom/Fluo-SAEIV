from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

VERSION = "1.0.61"

# Chaîne moderne unique chargée uniquement dans app.html. Le choix du rôle et
# l'authentification sont désormais assurés par index.html + login-gateway.js,
# totalement séparés du moteur conducteur historique.
MODULES = [
    "v128-gps.js",
    "v128-offline.js",
    "v130-session-orientation.js",
    "v131-speech.js",
    "v132-journals.js",
    "v133-profile-journals.js",
    "v134-journal-front.js",
    "v135-journal-router.js",
    "v136-driver-operations.js",
    "v137-driver-hub.js",
    "v141-static-fluo.js",
    "v144-day-hlp-driver.js",
    "v145-planning-tad.js",
    "v146-planning-tad-bridge.js",
    "v147-flow-journals-fix.js",
    "v148-continuous-day.js",
    "v150-journal-regulation.js",
    "v154-planning-service-times.js",
    "v155-planning-cut-percent.js",
    "v156-supabase-sync.js",
    "v157-exploitation.js",
    "v159-clean-runtime.js",
    "v160-entry-bridge.js",
]

SCRIPT_RE = re.compile(r"<script\b(?P<attrs>[^>]*)>(?P<body>.*?)</script\s*>", re.I | re.S)
MODULE_SRC_RE = re.compile(
    r"\s*<script\b[^>]*\bsrc\s*=\s*([\"'])\./v\d[^\"']*\.js(?:\?[^\"']*)?\1[^>]*>\s*</script\s*>\s*",
    re.I,
)


def executable_inline(attrs: str) -> bool:
    if re.search(r"\bsrc\s*=", attrs, re.I):
        return False
    m = re.search(r"\btype\s*=\s*([\"'])(.*?)\1", attrs, re.I | re.S)
    if not m:
        return True
    typ = m.group(2).strip().lower()
    return typ in {"", "text/javascript", "application/javascript", "module"}


def normalize_legacy_part(body: str) -> str:
    """Conserve les données/fonctions existantes mais fixe leurs contrats modernes."""
    replacements = [
        (
            "window.MonSAEIVAuthV13={logout,show:()=>logout(),networks:DRIVER_NETWORKS,get unlocked(){return V13.unlocked}};",
            "window.MonSAEIVAuthV13={logout,show:()=>logout(),remoteUnlock:(matricule,networkKey)=>setUnlocked(matricule,networkKey),networks:DRIVER_NETWORKS,get unlocked(){return V13.unlocked}};",
        ),
        (
            "const xs=itemsFor(date);let work=0,drive=0,euDrive=0,nationalDrive=0,breaks=0,first=Infinity,last=-Infinity;",
            "const xs=itemsFor(date);let work=0,drive=0,euDrive=0,nationalDrive=0,breaks=0,paidCut=0,first=Infinity,last=-Infinity;",
        ),
        (
            "if(m.work)work+=d;if(m.break)breaks+=d;if(m.drive){",
            "if(m.work)work+=d;if(x.type==='cut'){const cp=[0,25,50,75,100].includes(Number(x.cutPercent))?Number(x.cutPercent):0;const counted=d*cp/100;paidCut+=counted;work+=counted}if(m.break)breaks+=d;if(m.drive){",
        ),
        (
            "return{items:xs,work,drive,euDrive,nationalDrive,breaks,amplitude:",
            "return{items:xs,work,drive,euDrive,nationalDrive,breaks,paidCut,amplitude:",
        ),
        (
            "const rec={id:editingId||uid(),date:selectedDate,type,label:",
            "const rec={id:editingId||uid(),date:selectedDate,type,cutPercent:type==='cut'?Number(q('v155CutPercent')?.value||0):null,label:",
        ),
        (
            "function savePlan(){localStorage.setItem(PLAN_KEY,JSON.stringify(plan));renderAll()}",
            "function savePlan(){localStorage.setItem(PLAN_KEY,JSON.stringify(plan));renderAll();try{window.dispatchEvent(new CustomEvent('mon-saeiv-planning-changed',{detail:{items:plan.items.slice()}}))}catch{}}",
        ),
        (
            "window.FluoPlanningV316={open:openPlanner,items:()=>plan.items.slice(),metrics,complianceForWeek,prepareLinkedCourse,markDone:setDone,renderToday,openToday:()=>setDayMode(true)};",
            "window.FluoPlanningV316={open:openPlanner,items:()=>plan.items.slice(),syncFromServer:(items)=>{plan.items=Array.isArray(items)?items.slice():[];localStorage.setItem(PLAN_KEY,JSON.stringify(plan));renderAll();return plan.items.length},metrics,complianceForWeek,prepareLinkedCourse,markDone:setDone,renderToday,openToday:()=>setDayMode(true)};",
        ),
    ]
    for old, new in replacements:
        if old in body and new not in body:
            body = body.replace(old, new, 1)
    return body


def normalize_gateway_login() -> None:
    """Ne bloque jamais une connexion existante sur une règle de création récente.

    Les anciens profils SAEIV acceptaient des mots de passe à partir de 6 caractères.
    Le sas 1.0.61 avait mis minlength=8 sur les champs de *connexion* : Safari pouvait
    donc recevoir le clic, refuser silencieusement le submit natif et ne rien ouvrir.
    La longueur minimale reste appliquée à la création d'un nouveau mot de passe,
    jamais à la connexion à un compte existant.
    """
    gateway = Path("login.html")
    if not gateway.exists():
        return
    html = gateway.read_text(encoding="utf-8")
    html = html.replace(
        'id="driverPassword" type="password" autocomplete="current-password" minlength="8" required',
        'id="driverPassword" type="password" autocomplete="current-password" required',
    )
    html = html.replace(
        'id="managementPassword" type="password" autocomplete="current-password" minlength="8" required',
        'id="managementPassword" type="password" autocomplete="current-password" required',
    )
    if 'id="driverPassword" type="password" autocomplete="current-password" minlength=' in html:
        raise SystemExit("le sas conducteur impose encore une longueur minimale à la connexion")
    if 'id="managementPassword" type="password" autocomplete="current-password" minlength=' in html:
        raise SystemExit("le sas gestion impose encore une longueur minimale à la connexion")
    gateway.write_text(html, encoding="utf-8")
    print("Sas connexion corrigé : aucune longueur minimale imposée aux comptes existants.")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: externalize_runtime.py SITE_APP_HTML")

    normalize_gateway_login()

    page = Path(sys.argv[1])
    if not page.exists():
        raise SystemExit(f"application introuvable: {page}")

    html = page.read_text(encoding="utf-8")
    runtime_dir = page.parent / "runtime"
    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)
    runtime_dir.mkdir(parents=True)

    parts: list[str] = []
    part_names: list[str] = []

    def replace_script(match: re.Match[str]) -> str:
        attrs = match.group("attrs") or ""
        body = match.group("body") or ""
        if not executable_inline(attrs):
            return match.group(0)
        if not body.strip():
            return ""
        body = normalize_legacy_part(body)
        idx = len(parts) + 1
        name = f"part-{idx:03d}.js"
        parts.append(body.rstrip() + "\n")
        part_names.append(name)
        return f'<script src="./runtime/{name}?v={VERSION}"></script>'

    html = SCRIPT_RE.sub(replace_script, html)
    if not parts:
        raise SystemExit("aucun JavaScript inline trouvé à externaliser")

    # Les CDN Leaflet/MapLibre restent à leur place. Les modules Mon SAEIV sont
    # ensuite chargés une seule fois dans app.html. Le sélecteur de rôle V158 est
    # volontairement absent : il a été remplacé par le sas indépendant.
    html = MODULE_SRC_RE.sub("\n", html)
    module_tags = "\n".join(
        f'<script src="./{name}?v={VERSION}"></script>' for name in MODULES
    )
    if "</body>" not in html:
        raise SystemExit("balise </body> absente")
    html = html.replace("</body>", module_tags + "\n</body>", 1)

    html = re.sub(r"manifest\.webmanifest\?v=1\.0\.\d+", f"manifest.webmanifest?v={VERSION}", html)
    html = re.sub(r"<title>Mon SAEIV · 1\.0\.\d+</title>", f"<title>Mon SAEIV · {VERSION}</title>", html)

    for name, body in zip(part_names, parts):
        (runtime_dir / name).write_text(body, encoding="utf-8")

    manifest = {
        "version": VERSION,
        "generated": True,
        "parts": [f"runtime/{name}" for name in part_names],
        "modules": MODULES,
        "entry": "index.html",
        "application": "app.html",
    }
    (runtime_dir / "runtime-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    for m in SCRIPT_RE.finditer(html):
        if executable_inline(m.group("attrs") or ""):
            raise SystemExit("JavaScript inline résiduel après externalisation")

    page.write_text(html, encoding="utf-8")
    print(f"Runtime application externalisé : {len(parts)} scripts -> {runtime_dir}")


if __name__ == "__main__":
    main()
