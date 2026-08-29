from pathlib import Path
import json


def patch_index(path='index.html'):
    p = Path(path)
    s = p.read_text()

    def one(a, b):
        nonlocal s
        n = s.count(a)
        if n != 1:
            raise RuntimeError(f'Remplacement attendu 1 fois, trouvé {n}: {a[:120]!r}')
        s = s.replace(a, b)

    one('<link rel="manifest" href="manifest.webmanifest?v=1.0.26">', '<link rel="manifest" href="manifest.webmanifest?v=1.0.29">')
    one("jget('fluo_build.json?v=1.0.26')", "jget('fluo_build.json?v=1.0.29')")
    one("b.version||'1.0.26'", "b.version||'1.0.29'")
    one("navigator.serviceWorker.register('sw.js?v=1.0.26')", "navigator.serviceWorker.register('sw.js?v=1.0.29')")
    one("const APP_VERSION = '1.0.22';", "const APP_VERSION = '1.0.29';")
    one("  const VERSION='1.0.22';", "  const VERSION='1.0.29';")

    one("    diffbus:{key:'diffbus',label:'Diffbus · Differdange',kind:'urban'}\n",
        "    diffbus:{key:'diffbus',label:'Diffbus · Differdange',kind:'urban'},\n    luxtram:{key:'luxtram',label:'LuxTram · Luxembourg',kind:'urban'}\n")
    one('              <option value="diffbus">Diffbus · Differdange</option>\n',
        '              <option value="diffbus">Diffbus · Differdange</option>\n              <option value="luxtram">LuxTram · Luxembourg</option>\n')
    one("const NETWORKS=new Set(['rgtr','avl','tice','diffbus']);",
        "const NETWORKS=new Set(['rgtr','avl','tice','diffbus','luxtram']);")
    one("   - Réseaux urbains : LE MET’, TeMo’b, STAN, AVL, TICE et Diffbus via leurs GTFS officiels.\n",
        "   - Réseaux urbains : LE MET’, TeMo’b, STAN, AVL, TICE, Diffbus et LuxTram via leurs GTFS officiels.\n")
    one("    diffbus:{key:'diffbus',label:'Diffbus',city:'Differdange',sources:LUX_GTFS_SOURCES,filter:'diffbus'},\n    rgtr:{key:'rgtr',label:'RGTR',city:'Luxembourg',sources:LUX_GTFS_SOURCES,filter:'rgtr'},\n",
        "    diffbus:{key:'diffbus',label:'Diffbus',city:'Differdange',sources:LUX_GTFS_SOURCES,filter:'diffbus'},\n    luxtram:{key:'luxtram',label:'LuxTram',city:'Luxembourg',sources:LUX_GTFS_SOURCES,filter:'luxtram'},\n    rgtr:{key:'rgtr',label:'RGTR',city:'Luxembourg',sources:LUX_GTFS_SOURCES,filter:'rgtr'},\n")
    one("    if(cfg.filter==='diffbus')return /DIFFBUS|DIFFERDANGE/.test(agencyText)||/DIFFBUS|CITYBUS.*DIFFERDANGE|DIFFERDANGE.*CITYBUS/.test(routeText);\n    if(cfg.filter==='rgtr'){\n",
        "    if(cfg.filter==='diffbus')return /DIFFBUS|DIFFERDANGE/.test(agencyText)||/DIFFBUS|CITYBUS.*DIFFERDANGE|DIFFERDANGE.*CITYBUS/.test(routeText);\n    if(cfg.filter==='luxtram')return /LUXTRAM/.test(agencyText)||/LUXTRAM/.test(routeText)||String(r.route_type||'')==='0';\n    if(cfg.filter==='rgtr'){\n")
    one('<option value="urban:diffbus">Diffbus · Differdange</option>\'',
        '<option value="urban:diffbus">Diffbus · Differdange</option><option value="urban:luxtram">LuxTram · Luxembourg</option>\'')
    one("      if(lat>=49.46&&lat<=49.58&&lon>=5.78&&lon<=5.98&&!out.includes('diffbus'))out.push('diffbus');\n      if(lat>=49.35&&lat<=50.20&&lon>=5.65&&lon<=6.60&&!out.includes('rgtr'))out.push('rgtr');\n",
        "      if(lat>=49.46&&lat<=49.58&&lon>=5.78&&lon<=5.98&&!out.includes('diffbus'))out.push('diffbus');\n      if(lat>=49.48&&lat<=49.70&&lon>=6.00&&lon<=6.28&&!out.includes('luxtram'))out.push('luxtram');\n      if(lat>=49.35&&lat<=50.20&&lon>=5.65&&lon<=6.60&&!out.includes('rgtr'))out.push('rgtr');\n")
    one("    'urban:diffbus':{name:'Diffbus · Differdange',icon:'🇱🇺',urban:true,gtfs:true,network:'diffbus'},\n    'urban:stan'",
        "    'urban:diffbus':{name:'Diffbus · Differdange',icon:'🇱🇺',urban:true,gtfs:true,network:'diffbus'},\n    'urban:luxtram':{name:'LuxTram · Luxembourg',icon:'🚋',urban:true,gtfs:true,network:'luxtram'},\n    'urban:stan'")
    one("const NETWORK_LABELS={fluo:'Fluo Grand Est',stan:'STAN · Nancy',lemet:\"LE MET’ · Metz\",temob:\"TeMo’b · Thionville / Fensch\",rgtr:'RGTR · Luxembourg',avl:'AVL · Luxembourg-Ville',tice:'TICE · Esch / Sud Luxembourg',diffbus:'Diffbus · Differdange'};",
        "const NETWORK_LABELS={fluo:'Fluo Grand Est',stan:'STAN · Nancy',lemet:\"LE MET’ · Metz\",temob:\"TeMo’b · Thionville / Fensch\",rgtr:'RGTR · Luxembourg',avl:'AVL · Luxembourg-Ville',tice:'TICE · Esch / Sud Luxembourg',diffbus:'Diffbus · Differdange',luxtram:'LuxTram · Luxembourg'};")
    one("const NETWORK_CATALOGS={fluo:['fluo','fluo67'],stan:['stan'],lemet:['lemet'],temob:['temob'],rgtr:[],avl:[],tice:[],diffbus:[]};",
        "const NETWORK_CATALOGS={fluo:['fluo','fluo67'],stan:['stan'],lemet:['lemet'],temob:['temob'],rgtr:[],avl:[],tice:[],diffbus:[],luxtram:[]};")

    s = s.replace("document.title='Mon SAEIV · 1.0.26'", "document.title='Mon SAEIV · 1.0.29'")
    s = s.replace("e.textContent='MON SAEIV · 1.0.26'", "e.textContent='MON SAEIV · 1.0.29'")
    s = s.replace("b.textContent='Version 1.0.26'", "b.textContent='Version 1.0.29'")
    s = s.replace("text(PAGE_W-M-70,y,8,'1.0.26')", "text(PAGE_W-M-70,y,8,'1.0.29')")

    marker = '''\n<script id="v129LuxTramNetwork">\n'use strict';\n/* Mon SAEIV 1.0.29 — ajout du réseau LuxTram au catalogue luxembourgeois officiel. */\nwindow.MonSAEIVBuildPatch='1.0.29-luxtram';\n</script>\n'''
    pos = s.rfind('</body>')
    if pos < 0:
        raise RuntimeError('Balise </body> introuvable')
    s = s[:pos] + marker + s[pos:]
    p.write_text(s)


def patch_support_files():
    p = Path('manifest.webmanifest')
    s = p.read_text().replace('Mon SAEIV 1.0.28', 'Mon SAEIV 1.0.29').replace('./?v=1.0.28', './?v=1.0.29')
    p.write_text(s)
    json.loads(s)

    p = Path('fluo_build.json')
    s = p.read_text().replace('"version": "1.0.28"', '"version": "1.0.29"')
    p.write_text(s)
    json.loads(s)

    p = Path('sw.js')
    s = p.read_text().replace('mon-saeiv-v1-0-28', 'mon-saeiv-v1-0-29').replace('1.0.28', '1.0.29')
    p.write_text(s)

    p = Path('README_DEPLOIEMENT.txt')
    s = p.read_text()
    note = '''\n\nV1.0.29 — Ajout LuxTram Luxembourg\n- Ajout du réseau LuxTram dans le profil conducteur et dans le choix des réseaux urbains.\n- Chargement des lignes LuxTram depuis le GTFS national officiel luxembourgeois déjà utilisé par RGTR, AVL, TICE et Diffbus.\n- Filtrage dédié de l'agence LUXTRAM et prise en charge des lignes de type tramway.\n- Ajout de LuxTram dans la bibliothèque des fiches horaires et les correspondances inter-réseaux.\n- Radio, GPS projeté, reprise hors connexion et autres réseaux inchangés.\n'''
    if 'V1.0.29 — Ajout LuxTram Luxembourg' not in s:
        p.write_text(s + note)

    Path('VERSION_1_0_29.md').write_text('''# Mon SAEIV 1.0.29 — LuxTram\n\n- Ajout du réseau **LuxTram · Luxembourg**.\n- Source : GTFS national officiel luxembourgeois déjà utilisé par les autres réseaux du Grand-Duché.\n- Filtre dédié à l'agence `LUXTRAM`, avec repli sur les routes de tramway (`route_type = 0`).\n- LuxTram est disponible dans le profil conducteur, la prise de service, les fiches horaires et les correspondances.\n''')


if __name__ == '__main__':
    patch_index()
    patch_support_files()
