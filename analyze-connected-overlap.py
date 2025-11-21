#!/usr/bin/env python3
"""
Analyze overlap between connected carparks and carparks currently rendered on the map.
"""

import csv
import psycopg2
from difflib import SequenceMatcher

# Database connection
conn = psycopg2.connect(
    "postgres://postgres.sssyxnpanayqvamstind:S9MuK3OiFs3GZSp3@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
)
cursor = conn.cursor()

# Get all carparks from database
cursor.execute("""
    SELECT park_id, name, display_address
    FROM latest_vacancy_with_location
    WHERE vehicle_type = 'privateCar' AND vacancy > 0
    ORDER BY name
""")
db_carparks = cursor.fetchall()
db_names = {row[1].lower(): (row[0], row[1], row[2]) for row in db_carparks}

print(f"Database carparks (rendered on map): {len(db_carparks)}")
print()

# Read connected carparks CSV
connected_carparks = []
with open('/Users/markau/mtc-stations/connected-carparks/connected-carparks.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        connected_carparks.append(row)

print(f"Connected carparks: {len(connected_carparks)}")
print()

# Find matches
def similarity(a, b):
    """Calculate similarity ratio between two strings"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

matches = []
unmatched_connected = []

for conn_cp in connected_carparks:
    conn_name = conn_cp['Station Name']
    conn_address = conn_cp['Address']

    # Try exact match first
    if conn_name.lower() in db_names:
        matches.append({
            'connected_name': conn_name,
            'db_name': db_names[conn_name.lower()][1],
            'park_id': db_names[conn_name.lower()][0],
            'match_type': 'exact'
        })
    else:
        # Try fuzzy matching
        best_match = None
        best_score = 0.0

        for db_name_lower, (park_id, db_name, db_addr) in db_names.items():
            # Compare names
            name_score = similarity(conn_name, db_name)

            # Compare addresses if available
            addr_score = 0
            if conn_address and db_addr:
                addr_score = similarity(conn_address, db_addr)

            # Combined score (weighted towards name)
            combined_score = name_score * 0.7 + addr_score * 0.3

            if combined_score > best_score:
                best_score = combined_score
                best_match = (park_id, db_name, db_addr)

        # Consider it a match if score > 0.6
        if best_score > 0.6:
            matches.append({
                'connected_name': conn_name,
                'db_name': best_match[1],
                'park_id': best_match[0],
                'match_type': f'fuzzy ({best_score:.2f})'
            })
        else:
            unmatched_connected.append({
                'name': conn_name,
                'address': conn_address,
                'best_match': best_match[1] if best_match else 'None',
                'score': best_score
            })

print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total database carparks (rendered on map): {len(db_carparks)}")
print(f"Total connected carparks list: {len(connected_carparks)}")
print(f"Matched carparks: {len(matches)}")
print(f"Unmatched connected carparks: {len(unmatched_connected)}")
print(f"Overlap percentage: {len(matches) / len(connected_carparks) * 100:.1f}%")
print()

print("=" * 80)
print("MATCHED CARPARKS")
print("=" * 80)
for i, match in enumerate(matches, 1):
    print(f"{i}. {match['connected_name']}")
    if match['match_type'] != 'exact':
        print(f"   -> DB: {match['db_name']} ({match['match_type']})")
    print(f"   Park ID: {match['park_id']}")
print()

print("=" * 80)
print("UNMATCHED CONNECTED CARPARKS")
print("=" * 80)
for i, unmatched in enumerate(unmatched_connected, 1):
    print(f"{i}. {unmatched['name']}")
    print(f"   Address: {unmatched['address']}")
    print(f"   Best match: {unmatched['best_match']} (score: {unmatched['score']:.2f})")
    print()

cursor.close()
conn.close()
