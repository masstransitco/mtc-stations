#!/usr/bin/env python3
"""
Compare different matching methods for connected carparks:
1. Coordinate-based (current)
2. Address-based (normalized addresses)
3. Building polygon containment (using Building_GEOJSON)

This will help determine the most deterministic approach.
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
    # Remove common variations
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
    # Remove extra spaces
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

print(f"Database carparks: {len(db_carparks)}")

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

print(f"Connected carparks: {len(connected_carparks)}")
print()

# Method 1: Coordinate-based matching (100m threshold)
print("=" * 80)
print("METHOD 1: COORDINATE-BASED MATCHING (100m threshold)")
print("=" * 80)

coord_matches = []
for conn_cp in connected_carparks:
    for db_cp in db_carparks:
        park_id, db_name, db_addr, db_lat, db_lon = db_cp
        distance = haversine_distance(
            conn_cp['lat'], conn_cp['lon'],
            float(db_lat), float(db_lon)
        )
        if distance <= 100:
            coord_matches.append({
                'connected_name': conn_cp['name'],
                'db_name': db_name,
                'park_id': park_id,
                'distance_m': distance,
                'method': 'coordinate'
            })
            break  # Take first match

print(f"Matches: {len(coord_matches)}")
print(f"Overlap: {len(coord_matches) / len(connected_carparks) * 100:.1f}%")
print()

# Method 2: Address-based matching (0.7 similarity threshold)
print("=" * 80)
print("METHOD 2: ADDRESS-BASED MATCHING (0.7 similarity threshold)")
print("=" * 80)

addr_matches = []
for conn_cp in connected_carparks:
    best_match = None
    best_score = 0

    for db_cp in db_carparks:
        park_id, db_name, db_addr, db_lat, db_lon = db_cp

        # Calculate combined similarity
        addr_sim = address_similarity(conn_cp['address'], db_addr)
        name_sim = SequenceMatcher(None, conn_cp['name'].lower(), db_name.lower()).ratio()

        # Weight: 70% address, 30% name
        combined_score = addr_sim * 0.7 + name_sim * 0.3

        if combined_score > best_score:
            best_score = combined_score
            best_match = {
                'connected_name': conn_cp['name'],
                'connected_addr': conn_cp['address'],
                'db_name': db_name,
                'db_addr': db_addr,
                'park_id': park_id,
                'score': combined_score,
                'addr_sim': addr_sim,
                'name_sim': name_sim,
                'method': 'address'
            }

    if best_score >= 0.7:
        addr_matches.append(best_match)

print(f"Matches: {len(addr_matches)}")
print(f"Overlap: {len(addr_matches) / len(connected_carparks) * 100:.1f}%")
print()

# Show samples from address matching
print("Sample address matches:")
for i, match in enumerate(addr_matches[:5], 1):
    print(f"{i}. {match['connected_name']}")
    print(f"   Connected addr: {match['connected_addr']}")
    print(f"   DB addr: {match['db_addr']}")
    print(f"   Score: {match['score']:.2f} (addr: {match['addr_sim']:.2f}, name: {match['name_sim']:.2f})")
    print()

# Method 3: Building polygon containment check
print("=" * 80)
print("METHOD 3: BUILDING POLYGON CONTAINMENT CHECK")
print("=" * 80)

print("Loading building polygons from Building_GEOJSON...")

# Load building structures with polygons
building_file = '/Users/markau/mtc-stations/Building_GEOJSON/Building_Footprint_Public_20251017.gdb_BUILDING_STRUCTURE_converted.json'

try:
    # Create transformer from HK1980 Grid (EPSG:2326) to WGS84 (EPSG:4326)
    transformer = Transformer.from_crs("EPSG:2326", "EPSG:4326", always_xy=True)

    with open(building_file, 'r') as f:
        buildings_data = json.load(f)

    print(f"Loaded {len(buildings_data['features'])} building polygons")

    # Build spatial index of buildings
    buildings = []
    for feature in buildings_data['features']:
        if feature['geometry'] and feature['geometry']['type'] == 'Polygon':
            # Convert coordinates from HK1980 Grid to WGS84
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

    print(f"Transformed {len(buildings)} building polygons to WGS84")
    print()

    # Method 3a: Check if connected carpark coordinates fall within same building as DB carpark
    polygon_matches = []

    for conn_cp in connected_carparks:
        conn_point = Point(conn_cp['lon'], conn_cp['lat'])

        # Find which building contains the connected carpark point
        conn_building = None
        for bldg in buildings:
            if bldg['polygon'].contains(conn_point):
                conn_building = bldg
                break

        if conn_building:
            # Check if any DB carpark is in the same building
            for db_cp in db_carparks:
                park_id, db_name, db_addr, db_lat, db_lon = db_cp
                db_point = Point(float(db_lon), float(db_lat))

                if conn_building['polygon'].contains(db_point):
                    polygon_matches.append({
                        'connected_name': conn_cp['name'],
                        'db_name': db_name,
                        'park_id': park_id,
                        'building_id': conn_building['id'],
                        'building_name_en': conn_building['name_en'],
                        'building_name_tc': conn_building['name_tc'],
                        'method': 'polygon'
                    })
                    break

    print(f"Polygon containment matches: {len(polygon_matches)}")
    print(f"Overlap: {len(polygon_matches) / len(connected_carparks) * 100:.1f}%")
    print()

    print("Sample polygon matches:")
    for i, match in enumerate(polygon_matches[:10], 1):
        print(f"{i}. {match['connected_name']} -> {match['db_name']}")
        print(f"   Building: {match['building_name_en']} / {match['building_name_tc']}")
        print()

except FileNotFoundError:
    print("Building GEOJSON file not found!")
except Exception as e:
    print(f"Error loading building data: {e}")
    import traceback
    traceback.print_exc()

# Summary comparison
print("=" * 80)
print("SUMMARY COMPARISON")
print("=" * 80)
print(f"Method 1 (Coordinate 100m):  {len(coord_matches):3d} matches ({len(coord_matches) / len(connected_carparks) * 100:.1f}%)")
print(f"Method 2 (Address 0.7 sim):  {len(addr_matches):3d} matches ({len(addr_matches) / len(connected_carparks) * 100:.1f}%)")
print(f"Method 3 (Building polygon): {len(polygon_matches):3d} matches ({len(polygon_matches) / len(connected_carparks) * 100:.1f}%)")
print()

# Find overlap between methods
coord_ids = {m['park_id'] for m in coord_matches}
addr_ids = {m['park_id'] for m in addr_matches}
poly_ids = {m['park_id'] for m in polygon_matches}

print("Method agreement:")
print(f"Coord ∩ Address: {len(coord_ids & addr_ids)} matches")
print(f"Coord ∩ Polygon: {len(coord_ids & poly_ids)} matches")
print(f"Address ∩ Polygon: {len(addr_ids & poly_ids)} matches")
print(f"All three methods: {len(coord_ids & addr_ids & poly_ids)} matches")

cursor.close()
conn.close()
