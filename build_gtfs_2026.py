#!/usr/bin/env python3
"""Prépare côté GitHub Pages les données Fluo 54/57/67/68.

Les GTFS officiels sont reconstruits à chaque build. Les libellés de lignes simples
sont en plus recalés sur les terminus réellement desservis lorsque le producteur
conserve un ancien route_long_name composé de deux communes (ex. 57SMH04 :
VIC-SUR-SEILLE / MORHANGE -> ASSENONCOURT / MORHANGE).
"""
import csv
import io
import json
import re
import unicodedata
import zipfile
from pathlib import Path

import build_gtfs as base

FEEDS = {
    '57': {
        'label': 'Moselle (57)',
        'url': 'https://www.data.gouv.fr/api/1/datasets/r/42be7185-b2a8-4d1e-80c4-f7c402655260',
        'source': 'Fluo Grand Est 57 — GTFS officiel',
    },
    '54': {
        'label': 'Meurthe-et-Moselle (54)',
        'url': 'https://transport.data.gouv.fr/resources/80423/download',
        'source': 'Fluo Grand Est 54 — GTFS officiel nouvelle numérotation',
    },
    '67': {
        'label': 'Bas-Rhin (67)',
        'url': 'https://transport.data.gouv.fr/resources/80417/download',
        'source': 'Fluo Grand Est 67 — GTFS officiel',
    },
    '68': {
        'label': 'Haut-Rhin (68)',
        'url': 'https://transport.data.gouv.fr/resources/80419/download',
        'source': 'Fluo Grand Est 68 — GTFS officiel',
    },
}


def rows(zf, name):
    with zf.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))


def normalized(value):
    s = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'[^A-Z0-9]+', ' ', s).strip()
    words = {'ST': 'SAINT', 'STE': 'SAINTE', 'DVT': 'DEVANT', 'SS': 'SOUS'}
    return ' '.join(words.get(w, w) for w in s.split())


def stop_locality(stop_name):
    """Extrait la commune des poteaux au format « COMMUNE - arrêt ».

    Quand le producteur n'expose pas ce format, aucune correction de libellé n'est
    tentée : on garde le route_long_name officiel plutôt que de deviner.
    """
    s = str(stop_name or '').strip()
    if ' - ' not in s:
        return ''
    return s.split(' - ', 1)[0].strip()


def endpoint_pair_for_payload(dept, payload):
    """Renvoie les deux communes terminales seulement si tous les parcours concordent."""
    if str(dept) not in {'54', '57', '68'}:
        return None
    pairs = set()
    for pattern in payload.get('patterns') or []:
        stops = pattern.get('stops') or []
        if len(stops) < 2:
            continue
        a = stop_locality(stops[0].get('name'))
        b = stop_locality(stops[-1].get('name'))
        if not a or not b or normalized(a) == normalized(b):
            return None
        pairs.add(tuple(sorted((a, b), key=lambda x: normalized(x))))
    if len(pairs) != 1:
        return None
    return next(iter(pairs))


def safe_endpoint_refresh(current, endpoint_pair, known_localities):
    """Corrige seulement un ancien libellé qui est clairement « COMMUNE / COMMUNE ».

    Cette contrainte protège les noms commerciaux et lieux spéciaux (gare TGV,
    route touristique, etc.) : ils ne sont jamais remplacés automatiquement.
    """
    if not endpoint_pair:
        return ''
    a, b = endpoint_pair
    derived = f'{a} / {b}'
    cur = str(current or '').strip()
    cur_norm = normalized(cur)
    if normalized(a) in cur_norm and normalized(b) in cur_norm:
        return ''
    parts = [x.strip() for x in re.split(r'\s+/\s+', cur) if x.strip()]
    if len(parts) != 2:
        return ''
    if not all(normalized(part) in known_localities for part in parts):
        return ''
    return derived


def enrich_generated(dept, cfg):
    """Ajoute calendriers/TAD et fiabilise les libellés à partir du GTFS courant."""
    blob = base.download(cfg['url'], dept)
    zf = zipfile.ZipFile(io.BytesIO(blob))

    known_localities = {
        normalized(loc)
        for s in rows(zf, 'stops.txt')
        for loc in [stop_locality(s.get('stop_name'))]
        if loc
    }

    route_services = {}
    for t in rows(zf, 'trips.txt'):
        rid = str(t.get('route_id') or '')
        sid = str(t.get('service_id') or '')
        if rid and sid:
            route_services.setdefault(rid, set()).add(sid)

    demand = {}
    for st in rows(zf, 'stop_times.txt'):
        tid = str(st.get('trip_id') or '')
        if not tid:
            continue
        try:
            seq = int(float(st.get('stop_sequence') or 0))
        except Exception:
            seq = 0
        demand.setdefault(tid, []).append((
            seq,
            {
                'pickup_type': str(st.get('pickup_type') or '0'),
                'drop_off_type': str(st.get('drop_off_type') or '0'),
            },
        ))
    demand = {tid: [x[1] for x in sorted(xs, key=lambda z: z[0])] for tid, xs in demand.items()}

    data_dir = base.DATA / dept
    routes_dir = data_dir / 'routes'
    idx_path = data_dir / 'routes.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8'))
    idx_by_id = {str(r.get('id') or ''): r for r in idx.get('routes') or []}
    relabelled = 0

    for p in routes_dir.glob('*.json'):
        try:
            payload = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        changed = False
        for pattern in payload.get('patterns') or []:
            for trip in pattern.get('trips') or []:
                tid = str(trip.get('id') or '')
                ds = demand.get(tid)
                if ds and len(ds) == len(trip.get('times') or []):
                    trip['demand'] = ds
                    changed = True

        route = payload.get('route') or {}
        rid = str(route.get('id') or '')
        current = str(route.get('long') or '').strip()
        derived = safe_endpoint_refresh(
            current,
            endpoint_pair_for_payload(dept, payload),
            known_localities,
        )
        if derived:
            route['official_long'] = current
            route['long'] = derived
            route['long_source'] = 'unambiguous_service_endpoints_from_two_localities'
            listed = idx_by_id.get(rid)
            if listed is not None:
                listed['official_long'] = current
                listed['long'] = derived
                listed['long_source'] = 'unambiguous_service_endpoints_from_two_localities'
            relabelled += 1
            changed = True

        if changed:
            p.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    idx['prepared_at_build'] = True
    idx['runtime_gtfs_download_required'] = False
    idx['source_url'] = cfg['url']
    idx['route_labels_refreshed_from_service_endpoints'] = relabelled
    for route in idx.get('routes') or []:
        rid = str(route.get('id') or '')
        route['service_ids'] = sorted(route_services.get(rid, set()))
        route['static_gtfs'] = True
        route.pop('remote_gtfs', None)
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{dept}: {relabelled} ancien(s) libellé(s) commune/commune recalé(s) sur les terminus réels')


def validate_57_smh04():
    idx = json.loads((base.DATA / '57' / 'routes.json').read_text(encoding='utf-8'))
    route = next((r for r in idx.get('routes') or [] if str(r.get('short') or '').upper() == '57SMH04'), None)
    if not route:
        raise SystemExit('57: ligne 57SMH04 absente du GTFS officiel courant')
    label = normalized(route.get('long'))
    if 'ASSENONCOURT' not in label or 'MORHANGE' not in label:
        raise SystemExit(f"57SMH04: libellé courant incohérent après préparation: {route.get('long')!r}")


def rewrite_startup_usage_notice():
    """Réécrit l'information d'utilisation en encart non bloquant.

    L'ancien écran était une modale plein écran. Ce finaliseur la retire du HTML
    publié et insère un encart normal dans l'écran de prise de service. Ainsi,
    même si tout JavaScript ultérieur échoue, l'application reste cliquable.
    """
    page = Path('site/index.html')
    if not page.exists():
        raise SystemExit('site/index.html absent pendant la réécriture de l’information d’utilisation')
    html = page.read_text(encoding='utf-8')

    # Supprime le style de modale plein écran de la source historique.
    style_start = html.find('<style id="v3127UsageNoticeStyle">')
    if style_start != -1:
        style_end = html.find('</style>', style_start)
        if style_end == -1:
            raise SystemExit('style v3127UsageNoticeStyle incomplet')
        html = html[:style_start] + html[style_end + len('</style>'):]

    # Supprime physiquement la modale située avant .app. On ne tente plus de la
    # masquer après chargement : elle n'existe simplement plus dans le site publié.
    modal_start = html.find('<div id="v3127UsageNotice"')
    app_start = html.find('<div class="app">', modal_start if modal_start != -1 else 0)
    if modal_start == -1 or app_start == -1 or app_start <= modal_start:
        raise SystemExit('ancienne modale d’utilisation introuvable ou structure inattendue')
    html = html[:modal_start] + html[app_start:]

    inline_style = '''
<style id="v3127UsageNoticeStyle">
  .v3127-usage-inline{margin:0 0 14px;padding:14px;border:1px solid #3b5969;border-radius:16px;background:linear-gradient(135deg,#0d2633,#081923);box-shadow:0 10px 28px rgba(0,0,0,.16)}
  .v3127-usage-inline .eyebrow{margin-bottom:4px}.v3127-usage-inline h2{margin:0 0 8px;font-size:1.05rem}.v3127-usage-inline p{margin:7px 0;color:#bfd0d8;font-size:.72rem;line-height:1.48}.v3127-usage-inline strong{color:#fff}.v3127-usage-inline .v3127-usage-note{padding:8px 9px;border:1px solid #324f60;border-radius:10px;background:#071721}.v3127-usage-inline button{width:100%;margin-top:8px;min-height:44px}
</style>
'''
    if 'id="v3127UsageNoticeStyle"' not in html:
        head_end = html.find('</head>')
        if head_end == -1:
            raise SystemExit('balise </head> introuvable')
        html = html[:head_end] + inline_style + html[head_end:]

    setup_marker = '<section id="setup" class="panel">'
    if setup_marker not in html:
        raise SystemExit('écran setup introuvable pour l’encart d’utilisation')
    inline_notice = '''
    <aside id="v3127UsageNotice" class="v3127-usage-inline" aria-labelledby="v3127UsageTitle">
      <div class="eyebrow">INFORMATION D’UTILISATION</div>
      <h2 id="v3127UsageTitle">Mon SAEIV</h2>
      <p>Cette application est un <strong>outil d’aide au conducteur</strong>. Elle ne remplace pas les applications, procédures, documents ou consignes fournis par votre entreprise, l’exploitant ou l’autorité organisatrice.</p>
      <p class="v3127-usage-note">Malgré le soin apporté aux données et aux fonctionnalités, des erreurs, omissions ou décalages peuvent subsister. En cas de divergence, les outils, documents et consignes de référence de l’entreprise prévalent.</p>
      <p>Les informations, historiques et journaux constituent une aide de suivi et <strong>n’ont, à ce jour, pas valeur de justificatif officiel ou opposable</strong>.</p>
      <button id="v3127UsageContinue" type="button" class="primary" onclick="try{localStorage.setItem('monSaeivUsageAcceptedV3127','1')}catch(e){};var n=document.getElementById('v3127UsageNotice');if(n)n.remove();">J’ai compris</button>
    </aside>
    <script id="v3127InlineUsageState">(()=>{try{if(localStorage.getItem('monSaeivUsageAcceptedV3127')==='1')document.getElementById('v3127UsageNotice')?.remove()}catch(e){}})();</script>
'''
    html = html.replace(setup_marker, setup_marker + inline_notice, 1)

    # L'ancien listener peut rester : s'il trouve le nouvel encart il le masque,
    # sinon il ne fait rien. Il ne crée plus aucune couche bloquante.
    page.write_text(html, encoding='utf-8')

    # Retire du runtime publié le précédent bouton de déblocage temporaire.
    offline = Path('site/v128-offline.js')
    if offline.exists():
        js = offline.read_text(encoding='utf-8')
        marker = '\n/* Correctif de secours 2026-09-09 — empêche un écran de connexion superposé de bloquer l\'iPhone/PWA. */'
        if marker in js:
            js = js.split(marker, 1)[0].rstrip() + '\n'
            offline.write_text(js, encoding='utf-8')

    # Supprime également le garde-fou temporaire injecté par le service worker et
    # force un nouveau cache afin que Safari/PWA récupère cette réécriture.
    worker = Path('site/sw.js')
    if worker.exists():
        sw = worker.read_text(encoding='utf-8')
        sw_lines = []
        for line in sw.splitlines():
            if 'const usageGuard=' in line:
                continue
            if "v3127UsageEmergencyGuard" in line:
                continue
            if "t=t.replace(/<button id=\"v3127UsageContinue\"" in line:
                continue
            sw_lines.append(line)
        sw = '\n'.join(sw_lines) + '\n'
        sw = re.sub(r"const C='[^']+';", "const C='mon-saeiv-v1-0-56-inline-notice-1';", sw, count=1)
        worker.write_text(sw, encoding='utf-8')

    # Assertions de sécurité : aucune modale plein écran ne doit survivre.
    final = page.read_text(encoding='utf-8')
    if 'v3127-usage-backdrop' in final or 'aria-modal="true" aria-labelledby="v3127UsageTitle"' in final:
        raise SystemExit('la modale bloquante d’utilisation subsiste après réécriture')
    if 'class="v3127-usage-inline"' not in final:
        raise SystemExit('encart d’utilisation non bloquant absent après réécriture')
    print('Information d’utilisation réécrite : encart non bloquant, aucune modale au démarrage.')


def main():
    base.FEEDS = FEEDS
    base.main()
    for dept, cfg in FEEDS.items():
        enrich_generated(dept, cfg)

    build_path = base.DATA / 'build.json'
    build = json.loads(build_path.read_text(encoding='utf-8')) if build_path.exists() else {}
    build['version'] = 'Mon SAEIV 1.0.58 — GTFS Fluo officiels + libellés terminus fiabilisés'
    build['departments'] = ['54', '57', '67', '68']
    build['runtime_gtfs_download'] = {'54': False, '57': False, '67': False, '68': False}
    build['route_label_policy'] = 'route_long_name officiel; correction automatique uniquement pour un ancien libellé de deux communes et des terminus réels non ambigus'
    build_path.write_text(json.dumps(build, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    for dept in ('54', '57', '67', '68'):
        idx = json.loads((base.DATA / dept / 'routes.json').read_text(encoding='utf-8'))
        routes = idx.get('routes') or []
        if not routes:
            raise SystemExit(f'{dept}: aucune ligne générée depuis le GTFS officiel')
        if idx.get('runtime_gtfs_download_required') is not False:
            raise SystemExit(f'{dept}: données statiques non marquées comme prêtes')
        print(f'{dept}: {len(routes)} lignes prêtes pour publication statique')

    validate_57_smh04()
    print('57SMH04 validée : ASSENONCOURT / MORHANGE')
    rewrite_startup_usage_notice()


if __name__ == '__main__':
    main()
