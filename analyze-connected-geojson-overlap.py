#!/usr/bin/env python3
"""
Analyze overlap between database carparks and connected-carparks.geojson building polygons.
This determines how many database carparks are located within the buildings that have EV charging.
"""

import json
import psycopg2
from shapely.geometry import Point, shape

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

print(f"Database carparks (rendered on map): {len(db_carparks)}")
print()

# Load connected carparks GeoJSON (building polygons with EV charging)
print("Loading connected-carparks.geojson...")
with open('/Users/markau/mtc-stations/connected-carparks/connected-carparks.geojson', 'r') as f:
    connected_geojson = json.load(f)

print(f"Connected buildings with EV charging: {len(connected_geojson['features'])}")
print()

# Convert GeoJSON features to shapely polygons
connected_buildings = []
for feature in connected_geojson['features']:
    if feature['geometry'] and feature['geometry']['type'] == 'Polygon':
        connected_buildings.append({
            'place': feature['properties'].get('Place'),
            'address': feature['properties'].get('Address'),
            'district': feature['properties'].get('District'),
            'building_ids': feature['properties'].get('BUILDINGST'),
            'polygon': shape(feature['geometry'])
        })

print(f"Processed {len(connected_buildings)} building polygons")
print()

# Check which database carparks fall within connected building polygons
matches = []
db_carpark_points = []

for db_cp in db_carparks:
    park_id, db_name, db_addr, db_lat, db_lon = db_cp
    point = Point(float(db_lon), float(db_lat))
    db_carpark_points.append({
        'park_id': park_id,
        'name': db_name,
        'address': db_addr,
        'point': point
    })

print("Checking which database carparks are inside connected buildings...")
print("(This may take a moment...)")
print()

for db_cp_data in db_carpark_points:
    for building in connected_buildings:
        if building['polygon'].contains(db_cp_data['point']):
            matches.append({
                'park_id': db_cp_data['park_id'],
                'db_name': db_cp_data['name'],
                'db_address': db_cp_data['address'],
                'building_name': building['place'],
                'building_address': building['address'],
                'building_district': building['district']
            })
            break  # Only count each carpark once

print("=" * 80)
print("RESULTS: Database Carparks Inside Connected Buildings")
print("=" * 80)
print(f"Total database carparks: {len(db_carparks)}")
print(f"Total connected buildings with EV charging: {len(connected_buildings)}")
print(f"Database carparks INSIDE connected buildings: {len(matches)}")
print(f"Overlap percentage: {len(matches) / len(db_carparks) * 100:.1f}%")
print()

if len(matches) > 0:
    print("=" * 80)
    print("MATCHED CARPARKS (Database carparks inside EV charging buildings)")
    print("=" * 80)

    for i, match in enumerate(matches, 1):
        print(f"{i}. {match['db_name']}")
        print(f"   Park ID: {match['park_id']}")
        print(f"   Building: {match['building_name']}")
        print(f"   Building Address: {match['building_address']}")
        print(f"   District: {match['building_district']}")
        print()

    # Group by building
    buildings_with_matches = {}
    for match in matches:
        building_name = match['building_name']
        if building_name not in buildings_with_matches:
            buildings_with_matches[building_name] = []
        buildings_with_matches[building_name].append(match)

    print("=" * 80)
    print("BREAKDOWN BY BUILDING")
    print("=" * 80)
    print(f"Number of connected buildings that have database carparks: {len(buildings_with_matches)}")
    print()

    for building_name, building_matches in sorted(buildings_with_matches.items()):
        print(f"{building_name}: {len(building_matches)} database carpark(s)")
        for match in building_matches:
            print(f"  - {match['db_name']} ({match['park_id']})")
        print()

else:
    print("No database carparks found inside connected buildings.")

print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Connected buildings with EV charging stations: {len(connected_buildings)}")
print(f"Database carparks rendered on map: {len(db_carparks)}")
print(f"Buildings containing database carparks: {len(buildings_with_matches) if len(matches) > 0 else 0}")
print(f"Database carparks inside connected buildings: {len(matches)}")
print(f"Percentage of database carparks in EV charging buildings: {len(matches) / len(db_carparks) * 100:.1f}%")
print(f"Percentage of connected buildings with database carparks: {len(buildings_with_matches) / len(connected_buildings) * 100:.1f}% if len(matches) > 0 else 0")

cursor.close()
conn.close()
