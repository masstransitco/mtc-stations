# Non-Metered Parking API Notes

## What we learned
- Dataset page: https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1671693072228_72567&lang=en (viewer only; no unified API response).
- Live occupancy endpoint: `https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus` (CSV: FeatureID, ParkingSpaceId, OccupancyStatus, OccupancyDateChanged).
- Static geometry/attributes: `non-metered-parking-api/non-metered-parking.json` (GeoJSON with coords + multilingual street/region fields). Schema in `attribute-schema.csv`; vehicle type codes in `vehicletype-domain-codes.csv`.
- Counts match today: 145 features in GeoJSON; 145 rows from occupancy CSV; 1:1 matching on FeatureID and ParkingSpaceId (no missing/extra IDs either side).
- Occupancy values observed: V (Vacant), O (Occupied), NU (Not updated/Unknown). Sample CSV row: `FeatureID=2065, ParkingSpaceId=A101_CL_001, OccupancyStatus=V`.

## How to build with it
1) Fetch live CSV from the occupancy endpoint.
2) Join on `FeatureID` (or `ParkingSpaceId`) against the GeoJSON to add coordinates and metadata.
3) Serve combined result to the app (e.g., merge-and-cache service or build-time join if near-real-time is acceptable).

## Notes/risks
- Portal metadata endpoint at `/geoportal/api/datasets/...` returned 404; rely on CSV + local GeoJSON.
- Python stdlib on this machine needed SSL verification disabled to read the CSV; `curl` works normally.
- If the publisher adds/removes spaces, re-check counts and adjust joins accordingly.
