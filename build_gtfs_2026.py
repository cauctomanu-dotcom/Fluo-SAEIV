#!/usr/bin/env python3
"""Prépare côté GitHub Pages les données Fluo 54/57/67/68.

Objectif 1.0.40 : l'iPhone ne télécharge plus et ne décompresse plus les GTFS
54/67/68 à l'exécution. Les flux officiels sont transformés au build en JSON
statiques servis par Mon SAEIV.
"""
import csv
import io
import json
import zipfile
from pathlib import Path

import build_gtfs as base

FEEDS = {
    '57': {
        'label': 'Moselle (57)',
        'url': 'https://www.data.gouv.fr/api/1/datasets/r/42be7185-b2a8-4d1e-80c4-f7c402655260',
        'source': 'Fluo Grand Est 57',
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


def enrich_generated(dept, cfg):
    """Ajoute les métadonnées nécessaires aux filtres de date et dessertes à la demande."""
    blob = base.download(cfg['url'], dept)
    zf = zipfile.ZipFile(io.BytesIO(blob))

    trip_meta = {}
    route_services = {}
    for t in rows(zf, 'trips.txt'):
        tid = str(t.get('trip_id') or '')
        rid = str(t.get('route_id') or '')
        sid = str(t.get('service_id') or '')
        if tid:
            trip_meta[tid] = {'route_id': rid, 'service_id': sid}
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
        if changed:
            p.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    idx_path = data_dir / 'routes.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8'))
    idx['prepared_at_build'] = True
    idx['runtime_gtfs_download_required'] = False
    idx['source_url'] = cfg['url']
    for route in idx.get('routes') or []:
        rid = str(route.get('id') or '')
        route['service_ids'] = sorted(route_services.get(rid, set()))
        route['static_gtfs'] = True
        route.pop('remote_gtfs', None)
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def main():
    base.FEEDS = FEEDS
    base.main()
    for dept, cfg in FEEDS.items():
        enrich_generated(dept, cfg)

    build_path = base.DATA / 'build.json'
    build = json.loads(build_path.read_text(encoding='utf-8')) if build_path.exists() else {}
    build['version'] = 'Mon SAEIV 1.0.40 — GTFS Fluo préparés côté GitHub'
    build['departments'] = ['54', '57', '67', '68']
    build['runtime_gtfs_download'] = {'54': False, '67': False, '68': False}
    build_path.write_text(json.dumps(build, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # Garde-fous de publication : aucun département ciblé ne doit sortir vide.
    for dept in ('54', '67', '68'):
        idx = json.loads((base.DATA / dept / 'routes.json').read_text(encoding='utf-8'))
        routes = idx.get('routes') or []
        if not routes:
            raise SystemExit(f'{dept}: aucune ligne générée depuis le GTFS officiel')
        print(f'{dept}: {len(routes)} lignes prêtes pour publication statique')


if __name__ == '__main__':
    main()
