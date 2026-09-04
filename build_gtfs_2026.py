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


if __name__ == '__main__':
    main()
