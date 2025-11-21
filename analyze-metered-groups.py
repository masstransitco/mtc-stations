import json
from collections import defaultdict
import statistics

with open('metered-parking/metered-parking.geojson', 'r') as f:
    data = json.load(f)

# Group by District + SubDistrict + Street + SectionOfStreet
groups = defaultdict(list)
for feature in data['features']:
    props = feature['properties']
    coords = feature['geometry']['coordinates']

    key = (
        props['District'],
        props['SubDistrict'],
        props['Street'],
        props['SectionOfStreet']
    )

    groups[key].append({
        'id': props['ParkingSpaceId'],
        'lat': coords[1],
        'lng': coords[0]
    })

# Analyze geographic spread within groups
print("=== SAMPLE GROUPS WITH GEOGRAPHIC SPREAD ===\n")
sample_count = 0
for key, spaces in sorted(groups.items(), key=lambda x: len(x[1]), reverse=True)[:20]:
    if sample_count >= 10:
        break

    if len(spaces) < 10:
        continue

    lats = [s['lat'] for s in spaces]
    lngs = [s['lng'] for s in spaces]

    lat_range = max(lats) - min(lats)
    lng_range = max(lngs) - min(lngs)

    # Approximate distance in meters (rough calculation)
    lat_dist_m = lat_range * 111000  # 1 degree lat ≈ 111km
    lng_dist_m = lng_range * 111000 * 0.9  # adjusted for HK latitude

    print(f"Group: {key[3]}")
    print(f"  District: {key[0]}, SubDistrict: {key[1]}")
    print(f"  Street: {key[2]}")
    print(f"  Spaces: {len(spaces)}")
    print(f"  Lat range: {lat_range:.6f}° ({lat_dist_m:.1f}m)")
    print(f"  Lng range: {lng_range:.6f}° ({lng_dist_m:.1f}m)")
    print(f"  Center: {statistics.mean(lats):.6f}, {statistics.mean(lngs):.6f}")
    print()

    sample_count += 1

print("\n=== GROUPING SUMMARY ===")
print(f"Total groups: {len(groups)}")
print(f"Total spaces: {sum(len(spaces) for spaces in groups.values())}")
print(f"\nGroup size percentiles:")
sizes = sorted([len(spaces) for spaces in groups.values()])
print(f"  Min: {min(sizes)}")
print(f"  25th: {sizes[len(sizes)//4]}")
print(f"  Median: {statistics.median(sizes)}")
print(f"  75th: {sizes[3*len(sizes)//4]}")
print(f"  Max: {max(sizes)}")
