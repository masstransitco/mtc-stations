import json
import csv
from collections import defaultdict

# Load static parking space data
print("Loading static parking space data...")
with open('metered-parking/metered-parking.geojson', 'r') as f:
    geojson_data = json.load(f)

# Group spaces by carpark
print("Grouping spaces into carparks...")
carparks = defaultdict(lambda: {
    'spaces': [],
    'total_spaces': 0,
    'district': None,
    'sub_district': None,
    'street': None,
    'section': None,
    'name': None
})

for feature in geojson_data['features']:
    props = feature['properties']
    coords = feature['geometry']['coordinates']

    # Create carpark ID
    carpark_key = (
        props['District'],
        props['SubDistrict'],
        props['Street'],
        props['SectionOfStreet']
    )

    carpark_id = f"{props['District']}_{props['SubDistrict']}_{props['Street']}_{props['SectionOfStreet']}".replace(' ', '_').replace(',', '').upper()

    carparks[carpark_id]['spaces'].append(props['ParkingSpaceId'])
    carparks[carpark_id]['total_spaces'] += 1
    carparks[carpark_id]['district'] = props['District']
    carparks[carpark_id]['sub_district'] = props['SubDistrict']
    carparks[carpark_id]['street'] = props['Street']
    carparks[carpark_id]['section'] = props['SectionOfStreet']
    carparks[carpark_id]['name'] = props['SectionOfStreet']

print(f"Total carpark groups: {len(carparks)}")

# Load real-time occupancy data
print("\nLoading real-time occupancy data from /tmp/occupancy.csv...")
with open('/tmp/occupancy.csv', 'r') as f:
    occupancy_data = f.read().splitlines()

# Parse occupancy CSV
print("Parsing occupancy data...")
spaces_with_realtime = set()
csv_reader = csv.DictReader(occupancy_data)

for row in csv_reader:
    space_id = row['ParkingSpaceId'].strip()
    meter_status = row['ParkingMeterStatus'].strip()

    # Only count spaces with active meters (not NU - Not Usable)
    if meter_status == 'N':
        spaces_with_realtime.add(space_id)

print(f"Total spaces with real-time tracking: {len(spaces_with_realtime)}")

# Analyze carparks with real-time coverage
print("\nAnalyzing real-time coverage per carpark...")
carparks_with_realtime = []

for carpark_id, data in carparks.items():
    # Count how many spaces in this carpark have real-time data
    spaces_tracked = sum(1 for space_id in data['spaces'] if space_id in spaces_with_realtime)

    coverage_pct = (spaces_tracked / data['total_spaces'] * 100) if data['total_spaces'] > 0 else 0

    carparks_with_realtime.append({
        'carpark_id': carpark_id,
        'name': data['name'],
        'district': data['district'],
        'total_spaces': data['total_spaces'],
        'tracked_spaces': spaces_tracked,
        'coverage_pct': coverage_pct
    })

# Filter for carparks with >=10 spaces
carparks_10plus = [cp for cp in carparks_with_realtime if cp['total_spaces'] >= 10]

# Filter for carparks with real-time data (at least 1 space tracked)
carparks_with_data = [cp for cp in carparks_10plus if cp['tracked_spaces'] > 0]

# Sort by tracked spaces
carparks_with_data.sort(key=lambda x: x['tracked_spaces'], reverse=True)

print("\n" + "="*80)
print("SUMMARY: Carparks with ≥10 Spaces and Real-Time Data")
print("="*80)

print(f"\nTotal carpark groups: {len(carparks)}")
print(f"Carparks with ≥10 spaces: {len(carparks_10plus)}")
print(f"Carparks with ≥10 spaces AND real-time data: {len(carparks_with_data)}")

# Breakdown by coverage percentage
full_coverage = [cp for cp in carparks_with_data if cp['coverage_pct'] >= 90]
high_coverage = [cp for cp in carparks_with_data if 50 <= cp['coverage_pct'] < 90]
partial_coverage = [cp for cp in carparks_with_data if cp['coverage_pct'] < 50]

print(f"\nCoverage breakdown (≥10 spaces):")
print(f"  ≥90% coverage: {len(full_coverage)} carparks")
print(f"  50-89% coverage: {len(high_coverage)} carparks")
print(f"  <50% coverage: {len(partial_coverage)} carparks")

# Calculate total spaces
total_spaces_in_tracked = sum(cp['total_spaces'] for cp in carparks_with_data)
total_tracked_spaces = sum(cp['tracked_spaces'] for cp in carparks_with_data)

print(f"\nTotal spaces in carparks with real-time tracking:")
print(f"  Total spaces: {total_spaces_in_tracked}")
print(f"  Spaces with sensors: {total_tracked_spaces}")
print(f"  Overall coverage: {total_tracked_spaces/total_spaces_in_tracked*100:.1f}%")

# Show top 20 by tracked spaces
print("\n" + "="*80)
print("TOP 20 Carparks by Number of Tracked Spaces")
print("="*80)
print(f"\n{'Name':<50} {'District':<15} {'Tracked':>8} {'Total':>7} {'Coverage':>9}")
print("-"*100)

for cp in carparks_with_data[:20]:
    print(f"{cp['name'][:49]:<50} {cp['district'][:14]:<15} {cp['tracked_spaces']:>8} {cp['total_spaces']:>7} {cp['coverage_pct']:>8.1f}%")

# Show carparks with 100% coverage
full_100_coverage = [cp for cp in carparks_with_data if cp['coverage_pct'] == 100]
print(f"\n" + "="*80)
print(f"Carparks with 100% Real-Time Coverage (≥10 spaces): {len(full_100_coverage)}")
print("="*80)
print(f"\n{'Name':<50} {'District':<15} {'Spaces':>8}")
print("-"*80)

for cp in sorted(full_100_coverage, key=lambda x: x['total_spaces'], reverse=True)[:20]:
    print(f"{cp['name'][:49]:<50} {cp['district'][:14]:<15} {cp['total_spaces']:>8}")

# Export summary statistics
summary_stats = {
    'total_carpark_groups': len(carparks),
    'carparks_10plus_spaces': len(carparks_10plus),
    'carparks_with_realtime_10plus': len(carparks_with_data),
    'carparks_90plus_coverage': len(full_coverage),
    'carparks_100_coverage': len(full_100_coverage),
    'total_spaces_in_tracked_carparks': total_spaces_in_tracked,
    'total_tracked_spaces': total_tracked_spaces,
    'overall_coverage_pct': round(total_tracked_spaces/total_spaces_in_tracked*100, 2)
}

print("\n" + "="*80)
print("FINAL RECOMMENDATION")
print("="*80)
print(f"\nFor map display, we should show {len(carparks_with_data)} metered carparks:")
print(f"  - All have ≥10 spaces")
print(f"  - All have at least some real-time occupancy data")
print(f"  - Covering {total_tracked_spaces:,} spaces with real-time sensors")
print(f"  - Representing {total_spaces_in_tracked:,} total parking spaces")

# Save to JSON for later use
with open('metered-parking-realtime-summary.json', 'w') as f:
    json.dump(summary_stats, f, indent=2)

print("\n✓ Summary statistics saved to: metered-parking-realtime-summary.json")
