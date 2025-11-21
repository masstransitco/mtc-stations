#!/usr/bin/env python3
"""
Calculate unique matches in aggregate across all three methods:
- Coordinate-based (100m)
- Address-based (0.7 similarity)
- Building polygon containment

Shows total unique connected carparks that matched by ANY method.
"""

import csv
import json
import psycopg2
from math import radians, cos, sin, asin, sqrt
from difflib import SequenceMatcher
from shapely.geometry import Point, shape
from pyproj import Transformer

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lon points"""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return c * 6371000

def normalize_address(addr):
    """Normalize address for comparison"""
    if not addr:
        return ""
    addr = addr.lower().strip()
    replacements = {
        'road': 'rd',
        'street': 'st',
        'avenue': 'ave',
        'building': 'bldg',
        'centre': 'center',
        'car park': 'carpark',
        ',': '',
        '.': '',
    }
    for old, new in replacements.items():
        addr = addr.replace(old, new)
    addr = ' '.join(addr.split())
    return addr

def address_similarity(addr1, addr2):
    """Calculate similarity between two addresses"""
    norm1 = normalize_address(addr1)
    norm2 = normalize_address(addr2)
    return SequenceMatcher(None, norm1, norm2).ratio()

# Database connection
conn = psycopg2.connect(
    "postgres://postgres.sssyxnpanayqvamstind:S9MuK3OiFs3GZSp3@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
)
cursor = conn.cursor()

# Get all carparks from database
cursor.execute("""
    SELECT park_id, name, display_address, latitude, longitude
    FROM latest_vacancy_with_location
    WHERE vehicle_type = 'privateCar' AND vacancy > 0
    ORDER BY name
""")
db_carparks = cursor.fetchall()

# Read connected carparks CSV
connected_carparks = []
with open('/Users/markau/mtc-stations/connected-carparks/connected-carparks.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            connected_carparks.append({
                'name': row['Station Name'],
                'address': row['Address'],
                'lat': float(row['Latitude']),
                'lon': float(row['Longitude'])
            })
        except (ValueError, KeyError):
            pass

print(f"Database carparks: {len(db_carparks)}")
print(f"Connected carparks: {len(connected_carparks)}")
print()

# Track all matches with methods used
all_matches = {}  # Key: connected_name, Value: {db info, methods used}

# Method 1: Coordinate-based matching (100m threshold)
print("Running Method 1: Coordinate-based (100m)...")
for conn_cp in connected_carparks:
    for db_cp in db_carparks:
        park_id, db_name, db_addr, db_lat, db_lon = db_cp
        distance = haversine_distance(
            conn_cp['lat'], conn_cp['lon'],
            float(db_lat), float(db_lon)
        )
        if distance <= 100:
            if conn_cp['name'] not in all_matches:
                all_matches[conn_cp['name']] = {
                    'connected_name': conn_cp['name'],
                    'connected_addr': conn_cp['address'],
                    'db_name': db_name,
                    'park_id': park_id,
                    'methods': [],
                    'coord_distance': distance
                }
            all_matches[conn_cp['name']]['methods'].append('coordinate')
            all_matches[conn_cp['name']]['coord_distance'] = distance
            break

# Method 2: Address-based matching (0.7 similarity threshold)
print("Running Method 2: Address-based (0.7 similarity)...")
for conn_cp in connected_carparks:
    best_match = None
    best_score = 0

    for db_cp in db_carparks:
        park_id, db_name, db_addr, db_lat, db_lon = db_cp
        addr_sim = address_similarity(conn_cp['address'], db_addr)
        name_sim = SequenceMatcher(None, conn_cp['name'].lower(), db_name.lower()).ratio()
        combined_score = addr_sim * 0.7 + name_sim * 0.3

        if combined_score > best_score:
            best_score = combined_score
            best_match = (park_id, db_name, db_addr, combined_score)

    if best_score >= 0.7:
        if conn_cp['name'] not in all_matches:
            all_matches[conn_cp['name']] = {
                'connected_name': conn_cp['name'],
                'connected_addr': conn_cp['address'],
                'db_name': best_match[1],
                'park_id': best_match[0],
                'methods': [],
                'addr_score': best_score
            }
        all_matches[conn_cp['name']]['methods'].append('address')
        all_matches[conn_cp['name']]['addr_score'] = best_score
        all_matches[conn_cp['name']]['db_addr'] = best_match[2]

# Method 3: Building polygon containment check
print("Running Method 3: Building polygon containment...")
building_file = '/Users/markau/mtc-stations/Building_GEOJSON/Building_Footprint_Public_20251017.gdb_BUILDING_STRUCTURE_converted.json'

try:
    transformer = Transformer.from_crs("EPSG:2326", "EPSG:4326", always_xy=True)

    with open(building_file, 'r') as f:
        buildings_data = json.load(f)

    buildings = []
    for feature in buildings_data['features']:
        if feature['geometry'] and feature['geometry']['type'] == 'Polygon':
            coords = feature['geometry']['coordinates'][0]
            wgs84_coords = []
            for x, y in coords:
                lon, lat = transformer.transform(x, y)
                wgs84_coords.append((lon, lat))

            buildings.append({
                'id': feature['properties']['BUILDINGSTRUCTUREID'],
                'name_en': feature['properties'].get('OFFICIALBUILDINGNAMEEN'),
                'name_tc': feature['properties'].get('OFFICIALBUILDINGNAMETC'),
                'polygon': shape({'type': 'Polygon', 'coordinates': [wgs84_coords]})
            })

    for conn_cp in connected_carparks:
        conn_point = Point(conn_cp['lon'], conn_cp['lat'])

        conn_building = None
        for bldg in buildings:
            if bldg['polygon'].contains(conn_point):
                conn_building = bldg
                break

        if conn_building:
            for db_cp in db_carparks:
                park_id, db_name, db_addr, db_lat, db_lon = db_cp
                db_point = Point(float(db_lon), float(db_lat))

                if conn_building['polygon'].contains(db_point):
                    if conn_cp['name'] not in all_matches:
                        all_matches[conn_cp['name']] = {
                            'connected_name': conn_cp['name'],
                            'connected_addr': conn_cp['address'],
                            'db_name': db_name,
                            'park_id': park_id,
                            'methods': [],
                            'building_name_en': conn_building['name_en'],
                            'building_name_tc': conn_building['name_tc']
                        }
                    all_matches[conn_cp['name']]['methods'].append('polygon')
                    all_matches[conn_cp['name']]['building_name_en'] = conn_building['name_en']
                    all_matches[conn_cp['name']]['building_name_tc'] = conn_building['name_tc']
                    break

except Exception as e:
    print(f"Error with building polygon method: {e}")

print()
print("=" * 80)
print("AGGREGATE UNIQUE MATCHES")
print("=" * 80)
print(f"Total unique connected carparks matched (by ANY method): {len(all_matches)}")
print(f"Overlap percentage: {len(all_matches) / len(connected_carparks) * 100:.1f}%")
print()

# Breakdown by number of methods
method_counts = {}
for match in all_matches.values():
    num_methods = len(match['methods'])
    method_counts[num_methods] = method_counts.get(num_methods, 0) + 1

print("Breakdown by number of methods agreeing:")
for num_methods in sorted(method_counts.keys(), reverse=True):
    print(f"  {num_methods} methods: {method_counts[num_methods]} matches")
print()

# Show matches by method combination
method_combos = {}
for match in all_matches.values():
    combo = '+'.join(sorted(set(match['methods'])))
    if combo not in method_combos:
        method_combos[combo] = []
    method_combos[combo].append(match)

print("Breakdown by method combination:")
for combo, matches in sorted(method_combos.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"  {combo}: {len(matches)} matches")
print()

# Show all matches with method details
print("=" * 80)
print("ALL UNIQUE MATCHES (with methods used)")
print("=" * 80)

for i, match in enumerate(sorted(all_matches.values(), key=lambda x: len(x['methods']), reverse=True), 1):
    methods_str = ', '.join(sorted(set(match['methods'])))
    print(f"{i}. {match['connected_name']}")
    print(f"   -> DB: {match['db_name']} (park_id: {match['park_id']})")
    print(f"   Methods: {methods_str}")

    if 'coord_distance' in match:
        print(f"   - Coordinate distance: {match['coord_distance']:.1f}m")
    if 'addr_score' in match:
        print(f"   - Address similarity: {match['addr_score']:.2f}")
    if 'building_name_en' in match:
        print(f"   - Building: {match['building_name_en']} / {match['building_name_tc']}")
    print()

# Summary statistics
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total connected carparks in list: {len(connected_carparks)}")
print(f"Total database carparks rendered: {len(db_carparks)}")
print()
print(f"Individual method results:")
print(f"  - Coordinate-based (100m):     {sum(1 for m in all_matches.values() if 'coordinate' in m['methods'])} matches")
print(f"  - Address-based (0.7 sim):     {sum(1 for m in all_matches.values() if 'address' in m['methods'])} matches")
print(f"  - Building polygon containment: {sum(1 for m in all_matches.values() if 'polygon' in m['methods'])} matches")
print()
print(f"UNIQUE AGGREGATE TOTAL: {len(all_matches)} connected carparks matched")
print(f"Unmatched connected carparks: {len(connected_carparks) - len(all_matches)}")
print(f"Overall overlap: {len(all_matches) / len(connected_carparks) * 100:.1f}%")

cursor.close()
conn.close()
