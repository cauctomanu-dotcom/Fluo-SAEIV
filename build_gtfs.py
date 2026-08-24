#!/usr/bin/env python3
import csv, hashlib, io, json, math, os, urllib.request, zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
DATA = SITE / 'data'

FEEDS = {
    '57': {
        'label': 'Moselle (57)',
        'url': 'https://www.data.gouv.fr/api/1/datasets/r/42be7185-b2a8-4d1e-80c4-f7c402655260',
        'source': 'Fluo Grand Est 57',
    },
    '54': {
        'label': 'Meurthe-et-Moselle (54)',
        'url': 'https://www.data.gouv.fr/api/1/datasets/r/02d8c64b-734e-4e37-ace7-50fbfa5d5298',
        'source': 'Fluo Grand Est 54',
    },
}

def download(url: str, dept: str) -> bytes:
    # Permet de tester le générateur avec un GTFS local sans changer le workflow de production.
    override = os.environ.get(f'GTFS_{dept}_PATH')
    if override:
        return Path(override).read_bytes()
    req = urllib.request.Request(url, headers={'User-Agent': 'FluoSAEIV/10.0 (+GitHub Pages build)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def load_trace_overrides(dept: str):
    path = ROOT / 'scripts' / 'trace_overrides' / f'{dept}.json'
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data.get('shapes', {}) if isinstance(data, dict) else {}
    except Exception as e:
        print(f'Attention: overrides {dept} ignorés: {e}')
        return {}

def csv_rows(zf, name):
    with zf.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')
        yield from csv.DictReader(text)

def clean(s):
    return (s or '').strip()

def route_file_name(route_id: str) -> str:
    return hashlib.sha1(route_id.encode('utf-8')).hexdigest()[:20] + '.json'

def meters_xy(lat, lon, ref_lat):
    # projection équirectangulaire locale suffisante pour simplifier un tracé routier.
    x = math.radians(lon) * 6371000 * math.cos(math.radians(ref_lat))
    y = math.radians(lat) * 6371000
    return x, y

def point_segment_distance(p, a, b):
    px, py = p; ax, ay = a; bx, by = b
    dx, dy = bx-ax, by-ay
    if dx == 0 and dy == 0:
        return math.hypot(px-ax, py-ay)
    t = max(0.0, min(1.0, ((px-ax)*dx + (py-ay)*dy)/(dx*dx+dy*dy)))
    qx, qy = ax+t*dx, ay+t*dy
    return math.hypot(px-qx, py-qy)

def simplify(points, tolerance=18.0):
    if len(points) <= 2:
        return points
    ref_lat = sum(p[0] for p in points)/len(points)
    xy = [meters_xy(lat, lon, ref_lat) for lat, lon in points]
    keep = [False]*len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points)-1)]
    while stack:
        i, j = stack.pop()
        a, b = xy[i], xy[j]
        best_d, best_k = -1.0, None
        for k in range(i+1, j):
            d = point_segment_distance(xy[k], a, b)
            if d > best_d:
                best_d, best_k = d, k
        if best_k is not None and best_d > tolerance:
            keep[best_k] = True
            stack.append((i, best_k)); stack.append((best_k, j))
    return [points[i] for i, flag in enumerate(keep) if flag]

def build(dept, cfg):
    print(f'== {dept} {cfg["label"]}: téléchargement ==')
    blob = download(cfg['url'], dept)
    print(f'{len(blob)/1024/1024:.1f} MiB')
    zf = zipfile.ZipFile(io.BytesIO(blob))
    names = set(zf.namelist())

    stops = {}
    for s in csv_rows(zf, 'stops.txt'):
        try:
            lat, lon = float(s['stop_lat']), float(s['stop_lon'])
        except Exception:
            continue
        stops[s['stop_id']] = {
            'id': s['stop_id'], 'name': clean(s.get('stop_name')) or s['stop_id'],
            'lat': lat, 'lon': lon, 'code': clean(s.get('stop_code')),
        }

    routes = {}
    for r in csv_rows(zf, 'routes.txt'):
        rid = r['route_id']
        routes[rid] = {
            'id': rid,
            'short': clean(r.get('route_short_name')) or rid,
            'long': clean(r.get('route_long_name')),
            'type': clean(r.get('route_type')),
            'color': clean(r.get('route_color')),
            'text_color': clean(r.get('route_text_color')),
        }

    trips = {}
    route_trip_ids = defaultdict(list)
    for t in csv_rows(zf, 'trips.txt'):
        tid, rid = t['trip_id'], t['route_id']
        trips[tid] = {
            'route_id': rid,
            'headsign': clean(t.get('trip_headsign')),
            'direction_id': clean(t.get('direction_id')),
            'shape_id': clean(t.get('shape_id')),
            'service_id': clean(t.get('service_id')),
            'trip_short_name': clean(t.get('trip_short_name')),
            'block_id': clean(t.get('block_id')),
            'wheelchair_accessible': clean(t.get('wheelchair_accessible')),
        }
        route_trip_ids[rid].append(tid)

    shapes = defaultdict(list)
    if 'shapes.txt' in names:
        for s in csv_rows(zf, 'shapes.txt'):
            try:
                seq = int(float(s.get('shape_pt_sequence') or 0))
                lat, lon = float(s['shape_pt_lat']), float(s['shape_pt_lon'])
            except Exception:
                continue
            shapes[s['shape_id']].append((seq, lat, lon))
    trace_overrides = load_trace_overrides(dept)
    shape_cache = {}
    def get_shape(shape_id):
        if not shape_id:
            return []
        if shape_id in trace_overrides:
            try:
                pts = trace_overrides[shape_id]
                return [[round(float(p[0]),6), round(float(p[1]),6)] for p in pts if len(p) >= 2]
            except Exception:
                pass
        if shape_id not in shapes:
            return []
        if shape_id not in shape_cache:
            ordered = [(lat, lon) for _, lat, lon in sorted(shapes[shape_id], key=lambda x:x[0])]
            # V7: on conserve davantage de points que la V6 pour un map-matching plus fin.
            shape_cache[shape_id] = [[round(lat,6), round(lon,6)] for lat,lon in simplify(ordered, 6.0)]
        return shape_cache[shape_id]

    # Calendriers de service : nécessaires pour proposer la bonne course et déclencher
    # les annonces 5 min / 1 min avant le départ réel.
    service_rules = {}
    if 'calendar.txt' in names:
        for c in csv_rows(zf, 'calendar.txt'):
            sid = clean(c.get('service_id'))
            if not sid:
                continue
            service_rules[sid] = {
                'start': clean(c.get('start_date')),
                'end': clean(c.get('end_date')),
                'days': [int(c.get(k) or 0) for k in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')],
                'exceptions': {},
            }
    if 'calendar_dates.txt' in names:
        for c in csv_rows(zf, 'calendar_dates.txt'):
            sid = clean(c.get('service_id')); day = clean(c.get('date'))
            if not sid or not day:
                continue
            rule = service_rules.setdefault(sid, {'start':'','end':'','days':[0,0,0,0,0,0,0],'exceptions':{}})
            try:
                rule['exceptions'][day] = int(c.get('exception_type') or 0)
            except Exception:
                pass

    stop_times = defaultdict(list)
    for st in csv_rows(zf, 'stop_times.txt'):
        tid = st['trip_id']
        if tid not in trips:
            continue
        sid = st['stop_id']
        if sid not in stops:
            continue
        try:
            seq = int(st.get('stop_sequence') or 0)
        except Exception:
            seq = 0
        stop_times[tid].append({
            'seq': seq,
            'stop_id': sid,
            'arrival': clean(st.get('arrival_time')),
            'departure': clean(st.get('departure_time')),
        })

    outdir = DATA / dept
    routedir = outdir / 'routes'
    routedir.mkdir(parents=True, exist_ok=True)
    index = []

    for rid, route in routes.items():
        groups = {}
        for tid in route_trip_ids.get(rid, []):
            seq_items = sorted(stop_times.get(tid, []), key=lambda x: x['seq'])
            stop_ids = tuple(x['stop_id'] for x in seq_items)
            if len(stop_ids) < 2:
                continue
            t = trips[tid]
            # Le shape fait partie du parcours : deux courses desservant les mêmes arrêts
            # mais par des routes différentes restent distinctes dans le sélecteur.
            key = (stop_ids, t['headsign'], t['direction_id'], t['shape_id'])
            if key not in groups:
                groups[key] = {
                    'headsign': t['headsign'] or stops[stop_ids[-1]]['name'],
                    'direction': t['direction_id'],
                    'shape_id': t['shape_id'],
                    'stop_ids': stop_ids,
                    'examples': [],
                    'representative_times': seq_items,
                    'trips': [],
                }
            groups[key]['trips'].append({
                'id': tid,
                'service': t['service_id'],
                'headsign': t['headsign'],
                'trip_short_name': t.get('trip_short_name',''),
                'block_id': t.get('block_id',''),
                'times': [[x['arrival'], x['departure']] for x in seq_items],
            })
            ft = seq_items[0]['departure'] or seq_items[0]['arrival']
            if ft and len(groups[key]['examples']) < 8 and ft not in groups[key]['examples']:
                groups[key]['examples'].append(ft)

        patterns = []
        for g in groups.values():
            stop_objs = [dict(stops[sid]) for sid in g['stop_ids'] if sid in stops]
            if len(stop_objs) < 2:
                continue
            times_by_stop = {x['stop_id']:(x['arrival'],x['departure']) for x in g['representative_times']}
            for s in stop_objs:
                arr, dep = times_by_stop.get(s['id'], ('',''))
                if arr: s['arrival'] = arr
                if dep: s['departure'] = dep
            shp = get_shape(g['shape_id'])
            if not shp:
                shp = [[round(s['lat'],6), round(s['lon'],6)] for s in stop_objs]
            patterns.append({
                'headsign': g['headsign'],
                'direction': g['direction'],
                'examples': g['examples'],
                'trips': g['trips'],
                'shape_id': g['shape_id'],
                'trace_source': 'fusion_override' if g['shape_id'] in trace_overrides else 'fluo_gtfs',
                'shape': shp,
                'stops': stop_objs,
            })
        if not patterns:
            continue
        patterns.sort(key=lambda p: (p['headsign'].casefold(), p['stops'][0]['name'].casefold(), len(p['stops'])))
        fname = route_file_name(rid)
        with open(routedir / fname, 'w', encoding='utf-8') as f:
            json.dump({'route': route, 'patterns': patterns}, f, ensure_ascii=False, separators=(',', ':'))
        index.append({**route, 'file': f'routes/{fname}', 'patterns': len(patterns)})

    index.sort(key=lambda r: (r['short'].casefold(), r['long'].casefold()))
    with open(outdir / 'routes.json', 'w', encoding='utf-8') as f:
        json.dump({
            'department': dept,
            'label': cfg['label'],
            'source': cfg['source'],
            'routes': index,
            'stop_count': len(stops),
        }, f, ensure_ascii=False, separators=(',', ':'))
    with open(outdir / 'services.json', 'w', encoding='utf-8') as f:
        json.dump({'services': service_rules}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{dept}: {len(index)} lignes, {len(stops)} points d’arrêt, {sum(r["patterns"] for r in index)} parcours.')


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    for dept, cfg in FEEDS.items():
        build(dept, cfg)
    with open(DATA / 'build.json', 'w', encoding='utf-8') as f:
        import datetime
        json.dump({'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'version': 'V11 ANNONCES ARRIVÉE + PROCHAIN ARRÊT 15S + FORMATION + RÉGULATION + TAD + DEMANDES'}, f)

if __name__ == '__main__':
    main()
