#!/usr/bin/env python3
"""
Analyze overlap between connected carparks and carparks currently rendered on the map.
Uses coordinate-based matching (much more accurate than name matching).
"""

import csv
import psycopg2
from math import radians, cos, sin, asin, sqrt

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))

    # Radius of earth in meters
    r = 6371000
    return c * r

# Database connection
conn = psycopg2.connect(
    "postgres://postgres.sssyxnpanayqvamstind:S9MuK3OiFs3GZSp3@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
)
cursor = conn.cursor()

# Get all carparks from database with coordinates
cursor.execute("""
    SELECT park_id, name, display_address, latitude, longitude
    FROM latest_vacancy_with_location
    WHERE vehicle_type = 'privateCar' AND vacancy > 0
    ORDER BY name
""")
db_carparks = cursor.fetchall()

print(f"Database carparks (rendered on map): {len(db_carparks)}")
print()

# Read connected carparks CSV
connected_carparks = []
with open('/Users/markau/mtc-stations/connected-carparks/connected-carparks.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            lat = float(row['Latitude'])
            lon = float(row['Longitude'])
            connected_carparks.append({
                'name': row['Station Name'],
                'address': row['Address'],
                'lat': lat,
                'lon': lon
            })
        except (ValueError, KeyError):
            print(f"Warning: Skipping {row.get('Station Name', 'Unknown')} - missing/invalid coordinates")

print(f"Connected carparks (with valid coordinates): {len(connected_carparks)}")
print()

# Find matches based on proximity
# We'll consider carparks within 100m as a match
MATCH_THRESHOLD_METERS = 100

matches = []
unmatched_connected = []

for conn_cp in connected_carparks:
    closest_match = None
    closest_distance = float('inf')

    for db_cp in db_carparks:
        park_id, db_name, db_addr, db_lat, db_lon = db_cp

        distance = haversine_distance(
            conn_cp['lat'], conn_cp['lon'],
            float(db_lat), float(db_lon)
        )

        if distance < closest_distance:
            closest_distance = distance
            closest_match = {
                'park_id': park_id,
                'db_name': db_name,
                'db_addr': db_addr,
                'db_lat': db_lat,
                'db_lon': db_lon
            }

    if closest_distance <= MATCH_THRESHOLD_METERS:
        matches.append({
            'connected_name': conn_cp['name'],
            'connected_address': conn_cp['address'],
            'connected_lat': conn_cp['lat'],
            'connected_lon': conn_cp['lon'],
            'db_name': closest_match['db_name'],
            'db_addr': closest_match['db_addr'],
            'park_id': closest_match['park_id'],
            'distance_m': closest_distance
        })
    else:
        unmatched_connected.append({
            'name': conn_cp['name'],
            'address': conn_cp['address'],
            'lat': conn_cp['lat'],
            'lon': conn_cp['lon'],
            'nearest_db_name': closest_match['db_name'] if closest_match else 'None',
            'distance_m': closest_distance
        })

print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total database carparks (rendered on map): {len(db_carparks)}")
print(f"Total connected carparks list: {len(connected_carparks)}")
print(f"Matched carparks (within {MATCH_THRESHOLD_METERS}m): {len(matches)}")
print(f"Unmatched connected carparks: {len(unmatched_connected)}")
print(f"Overlap percentage: {len(matches) / len(connected_carparks) * 100:.1f}%")
print()

print("=" * 80)
print(f"MATCHED CARPARKS (within {MATCH_THRESHOLD_METERS}m)")
print("=" * 80)
for i, match in enumerate(sorted(matches, key=lambda x: x['distance_m']), 1):
    print(f"{i}. {match['connected_name']}")
    if match['connected_name'].lower() != match['db_name'].lower():
        print(f"   -> DB name: {match['db_name']}")
    print(f"   Park ID: {match['park_id']}")
    print(f"   Distance: {match['distance_m']:.1f}m")
    if match['distance_m'] > 50:
        print(f"   Connected addr: {match['connected_address']}")
        print(f"   DB addr: {match['db_addr']}")
    print()

print("=" * 80)
print("UNMATCHED CONNECTED CARPARKS")
print("=" * 80)
print(f"(Nearest database carpark is >{MATCH_THRESHOLD_METERS}m away)")
print()
for i, unmatched in enumerate(sorted(unmatched_connected, key=lambda x: x['distance_m']), 1):
    print(f"{i}. {unmatched['name']}")
    print(f"   Address: {unmatched['address']}")
    print(f"   Coordinates: {unmatched['lat']:.6f}, {unmatched['lon']:.6f}")
    print(f"   Nearest DB carpark: {unmatched['nearest_db_name']} ({unmatched['distance_m']:.0f}m away)")
    print()

cursor.close()
conn.close()
