#!/usr/bin/env python3
"""
Export two CSV files:
1. database-carparks.csv - All carparks from the database
2. connected-carparks-formatted.csv - Connected carparks in the same format
"""

import csv
import psycopg2

# Database connection
conn = psycopg2.connect(
    "postgres://postgres.sssyxnpanayqvamstind:S9MuK3OiFs3GZSp3@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
)
cursor = conn.cursor()

# Get all carparks from database
print("Fetching database carparks...")
cursor.execute("""
    SELECT park_id, name, display_address, district, latitude, longitude
    FROM latest_vacancy_with_location
    WHERE vehicle_type = 'privateCar' AND vacancy > 0
    ORDER BY name
""")
db_carparks = cursor.fetchall()

print(f"Found {len(db_carparks)} database carparks")

# Export database carparks to CSV
print("Exporting database-carparks.csv...")
with open('/Users/markau/mtc-stations/database-carparks.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['park_id', 'name', 'address', 'district', 'latitude', 'longitude'])

    for row in db_carparks:
        park_id, name, address, district, lat, lon = row
        writer.writerow([
            park_id,
            name,
            address if address else '',
            district if district else '',
            float(lat),
            float(lon)
        ])

print(f"✓ Exported {len(db_carparks)} database carparks to database-carparks.csv")

# Read connected carparks CSV
print("\nReading connected-carparks.csv...")
connected_carparks = []
with open('/Users/markau/mtc-stations/connected-carparks/connected-carparks.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            connected_carparks.append({
                'name': row['Station Name'],
                'address': row['Address'],
                'district': row.get('District', ''),  # May not exist in original
                'latitude': float(row['Latitude']),
                'longitude': float(row['Longitude'])
            })
        except (ValueError, KeyError) as e:
            print(f"Warning: Skipping row due to error: {e}")

print(f"Found {len(connected_carparks)} connected carparks")

# Export connected carparks in matching format
print("Exporting connected-carparks-formatted.csv...")
with open('/Users/markau/mtc-stations/connected-carparks-formatted.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['park_id', 'name', 'address', 'district', 'latitude', 'longitude'])

    for i, cp in enumerate(connected_carparks, 1):
        writer.writerow([
            f'connected_{i}',  # Generate a simple ID since they don't have park_id
            cp['name'],
            cp['address'],
            cp['district'],
            cp['latitude'],
            cp['longitude']
        ])

print(f"✓ Exported {len(connected_carparks)} connected carparks to connected-carparks-formatted.csv")

# Summary
print("\n" + "=" * 80)
print("EXPORT SUMMARY")
print("=" * 80)
print(f"database-carparks.csv: {len(db_carparks)} carparks")
print(f"connected-carparks-formatted.csv: {len(connected_carparks)} carparks")
print("\nBoth files use the same format:")
print("  - park_id, name, address, district, latitude, longitude")

cursor.close()
conn.close()
