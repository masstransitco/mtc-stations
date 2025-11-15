This Markdown condenses the Parking Vacancy Data Specification v1.2 into a repo-ready reference: API endpoint, parameters, response formats, and full field dictionaries for car park info and vacancy data. It’s structured so you can drop sections directly into docs or code comments.

# API Review

  - Dataset contains two JSON payloads that mirror the Transport Department “Car Park Vacancy”
    API output: basic_info_all.json exposes 487 park_id entries with multilingual names,
    formatted addresses, district metadata, lat/long, contact no., opening status, vehicle
    height limit, remarks, photo URLs, and websites (basic_info_all.json:1). vacancy_all.json
    matches those park_ids with one or more vehicle_type blocks, each carrying
    service_category arrays composed of category, vacancy_type, vacancy, and lastupdate fields
    (vacancy_all.json:1).
  - The static dump shows only HOURLY service categories, so consumers shouldn’t expect daily/
    monthly quotas from this feed. Vehicle types appear as single-letter codes (P, M, P_D,
    L, H, B, C, T, O, N), so clients must translate these from the official mapping before
    display (vacancy_all.json:1).
  - park_id is the join key between base metadata and live counts. Because every car_park
    object is a flat list element and there’s no pagination marker, clients can cache
    basic_info and periodically poll only the vacancy endpoint (rename basic_info_all.json →
    data=info, vacancy_all.json → data=vacancy when hitting the real API).
  - Data quality considerations: 217 parks have blank contact numbers, 226 have height: 0, and
    opening_status varies between OPEN, open, and null, so normalization is needed before use
    (basic_info_all.json:1). Vacancy records show 665 service entries in total, but 274 expose
    vacancy = -1, which the spec treats as “unknown/offline”, while vacancy_type values span
    A, B, and C, indicating differing confidence or sensor classes (vacancy_all.json:1).
  - carpark_photo URLs are HTTP and some remark_* fields embed HTML fragments (e.g., <br>),
    so renderers must sanitize and upgrade links where possible (basic_info_all.json:1).
    The vacancy timestamps are per (park_id, vehicle_type, service_category) combination
    and formatted as YYYY-MM-DD hh:mm:ss, making it easy to detect stale records
    (vacancy_all.json:1).

 - HK’s official feed stays a public REST GET endpoint at https://api.data.gov.hk/v1/
    carpark-info-vacancy returning UTF‑8 JSON with no auth, and it is still driven by the
    data selector (info vs. vacancy) plus optional filters for vehicleTypes, carparkIds, map
    extent, and lang (en_US, zh_TW, zh_CN) (parking-vacancy-api-specs.md:27-49). Those inputs
    plus the HTTP status table at 200/400/500/503 outline the current integration contract
    (parking-vacancy-api-specs.md:52-60).
  - Responses remain results arrays keyed by park_Id, where each vehicle-type property
    (privateCar, LGV, HGV, CV, coach, motorCycle) carries vacancy objects containing
    vacancy_type, absolute/flagged vacancy, optional EV/DIS/UNL counts, and a lastupdate
    timestamp in YYYY-MM-DD HH:MM:SS; the feed can also include category markers such as
    HOURLY/DAILY/MONTHLY (parking-vacancy-api-specs.md:63-136 and parking-vacancy-api-
    specs.md:385-408). The spec still enforces three vacancy modes (A actual, B boolean, C
    closed) with shared semantics for 0, 1, and -1 (parking-vacancy-api-specs.md:412-424).
  - The basic info payload remains a richer schema on data=info: besides the human-readable
    displayAddress, district, geo coordinates, contact info, opening_status, imagery
    (renditionUrls), URLs, and timestamps, it supports localized structured addresses, opening
    hours, grace periods, height limits, facilities, payment methods, and per-vehicle blocks
    that describe spaces, EV/disabled allocations, tariff tables, day/night packs, monthly
    plans, unloading slots, and privilege windows (parking-vacancy-api-specs.md:141-381).
  - Comparing the live spec to the local dumps shows the upstream API adding more metadata
    than our cached JSON reflects. The spec expects top-level results and camelCase vehicle-
    type properties, while our files expose flattened car_park arrays with vehicle_type/
    service_category nesting (basic_info_all.json:1, vacancy_all.json:1). That suggests the
    repo contains a transformed snapshot rather than the raw API output, so any new ingestion
    should either rehydrate the original results structure (to stay spec-compliant) or keep
    documenting the transformation layer.
  - State-wise, nothing in v1.2 indicates deprecation; the feed still aggregates Transport
    Department, EKEO, and operator submissions, and it offers fine-grained filters to limit
    what you pull. Next steps: confirm whether we want to keep mirroring the upstream fields
    (like nature, facilities, paymentMethods, vacancyDIS/EV/UNL) that are defined in the
    spec but absent from our cached data, and ensure client code respects the vacancy-type
    semantics to avoid treating -1 as real counts.
- Out of the 487 car parks in the latest dump, 312 currently report at least one
    HOURLY service_category with a non-negative vacancy (i.e., “live” data per the spec’s
    vacancy_type rules), leaving 175 sites still returning -1 for every HOURLY record
    (vacancy_all.json:1). That’s 64.1 % live coverage for hourly spaces.
  - vacancy_type mix for those live HOURLY feeds: 240 vehicle-type entries are true numeric
    counts (A), 148 are binary availability flags (B), and 3 indicate closed status (C)
    (vacancy_all.json:1). Operators therefore mostly send actual stall counts, but ~38 % of
    the live feed is still boolean-only.
  - Vehicle-type reach (live entries vs. total entries in the file): Private Car 308/477
    (65 %), Motorcycle 30/57 (53 %), Light-Goods Vehicle 20/41 (49 %), Private Coach/
    Disabled (P_D) 13/41 (32 %), Heavy-Goods 9/18 (50 %), Bus 5/13 (38 %), Coach 3/10 (30 %),
    Others 2/3 (67 %), Tractor/Trailer 1/4 (25 %), with no live data for the sole N record
    (vacancy_all.json:1). This highlights that hourly updates are concentrated on private
    cars, with specialty vehicle feeds lagging.
  - Timestamps bundled with those records (e.g., 2025-11-15 12:39:51) show that the trace
    you’re reviewing is cohesive across operators—the live entries all refreshed in the
    same minute-long window, while the parks stuck on -1 haven’t reported since that poll
    (vacancy_all.json:1).
⸻


# Parking Vacancy Data Specification (v1.2)

Source: One Stop Parking Vacancy Data Specification, Version 1.2 (14 Jan 2020).  [oai_citation:0‡Parking_Vacancy_Data_Specification.pdf](sediment://file_00000000418c71f59007ea600287943e)  

---

## 1. Introduction

The API exposes:
- **Parking vacancy data** (per vehicle type, availability).
- **Basic car park information** (location, fees, opening hours, height limits, facilities, payment methods, etc.).

Data providers:
- Transport Department (TD)
- Energizing Kowloon East Office (EKEO)
- Participating car park operators

---

## 2. API Overview

### 2.1 Endpoint

- **API Type:** REST  
- **Method:** `GET`  
- **URL:** `https://api.data.gov.hk/v1/carpark-info-vacancy`  
- **Response format:** JSON  
- **Encoding:** UTF-8  
- **Authentication:** Not required  

---

## 3. Request Parameters

All parameters are **optional** unless specified otherwise.

| Param        | Type   | Default | Allowed Values / Format                                                                                   | Description |
|-------------|--------|---------|----------------------------------------------------------------------------------------------------------|------------|
| `data`      | enum   | `info`  | `info` – basic car park info; `vacancy` – parking vacancy data                                          | Selects info vs vacancy payloads |
| `vehicleTypes` | enum / CSV | – | `privateCar`, `LGV`, `HGV`, `CV`, `coach`, `motorCycle`                                                | Filters by vehicle type |
| `carparkIds`   | CSV   | –       | Comma separated car park IDs (e.g. `10,12,27`)                                                          | Filters by car park IDs |
| `extent`       | string| –       | `leftLon,bottomLat,rightLon,topLat` (bounding rectangle)                                               | Filters car parks within bounding box |
| `lang`         | enum  | `en_US` | `en_US`, `zh_TW`, `zh_CN` (falls back to `zh_TW` if `zh_CN` missing)                                   | Display language |

---

## 4. Response Codes

| HTTP Code | Meaning                     |
|----------|-----------------------------|
| 200      | Success                     |
| 400      | Bad Request                 |
| 500      | Internal Server Error       |
| 503      | Service Unavailable         |

---

## 5. Example Request and Response

### 5.1 Example Request

```http
GET https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar&lang=en_US

5.2 Example Response (truncated)

{
  "results": [
    {
      "park_Id": "10",
      "privateCar": [
        {
          "vacancy_type": "A",
          "vacancy": 94,
          "lastupdate": "2018-10-02 11:06:21"
        }
      ]
    },
    {
      "park_Id": "12",
      "privateCar": [
        {
          "vacancy_type": "A",
          "vacancyEV": 5,
          "vacancyDIS": 6,
          "vacancy": 155,
          "lastupdate": "2018-10-02 11:01:05"
        }
      ],
      "LGV": [
        {
          "vacancy_type": "A",
          "vacancy": 0,
          "lastupdate": "2018-10-02 11:01:05"
        }
      ],
      "HGV": [
        {
          "vacancy_type": "A",
          "vacancy": 0,
          "lastupdate": "2018-10-02 11:01:05"
        }
      ],
      "motorCycle": [
        {
          "vacancy_type": "A",
          "vacancy": 0,
          "lastupdate": "2018-10-02 11:01:05"
        }
      ]
    },
    {
      "park_Id": "27",
      "privateCar": [
        {
          "vacancy_type": "A",
          "vacancyDIS": 1,
          "vacancy": 12,
          "lastupdate": "2018-10-02 08:48:52"
        }
      ],
      "motorCycle": [
        {
          "vacancy_type": "A",
          "vacancy": 2,
          "lastupdate": "2018-10-02 08:48:52"
        }
      ]
    }
  ]
}


⸻

6. Data Dictionary — Basic Car Park Information (data=info)

6.1 Top-Level Fields

#	Field	Type	Required	Description
1	park_Id	string	Y	System ID of car park
2	name	string	Y	Name of car park
3	nature	string	N	government or commercial
4	carpark_Type	string	N	multi-storey, off-street, metered
5	address	object	N	Structured address (per locale)
6	displayAddress	string	Y	Display-friendly address
7	district	string	N	District name
8	latitude	number	Y	Latitude of car park
9	longitude	number	Y	Longitude of car park
10	contactNo	string	N	Telephone number
11	renditionUrls	object	N	Image URLs (if available)
12	website	string	N	Car park website URL
13	opening_status	string	N	OPEN or CLOSED
14	openingHours	object[]	N	Array of opening hour rules
15	gracePeriods	object[]	N	Free parking duration rules
16	heightLimits	object[]	N	Vehicle height limits
17	facilities	string[]	N	Supported facilities
18	paymentMethods	string[]	N	Supported payment methods
19	privateCar	object	N	Info for private cars (spaces, fees, etc.)
20	LGV	object	N	Info for light goods vehicles
21	HGV	object	N	Info for heavy goods vehicles
22	CV	object	N	Info for container vehicles
23	coach	object	N	Info for coaches
24	motorCycle	object	N	Info for motorcycles
25	creationDate	string	N	Creation time YYYY-MM-DD HH:MM:SS
26	modifiedDate	string	N	Last modified time
27	publishedDate	string	N	Publication time
28	lang	string	Y	en_US, zh_TW, or zh_CN


⸻

6.2 address Object

Locale-dependent address components.

Field	Type	Req	Description
unitNo	string	N	Unit number
unitDescriptor	string	N	Unit descriptor
floor	string	N	Floor
blockNo	string	N	Block number
blockDescriptor	string	N	Block descriptor
buildingName	string	N	Building name
phase	string	N	Phase
estateName	string	N	Estate name
villageName	string	N	Village name
streetName	string	N	Street name
buildingNo	string	N	Building number
subDistrict	string	Y	Sub-district
dcDestrict	string	Y	District
region	string	Y	Region


⸻

6.3 renditionUrls Object

Image renditions (if photos exist).

Field	Type	Description
square	string	150×150 center-cropped square image URL
thumbnail	string	Center-cropped, max 320×250 image URL
banner	string	300×250 center-cropped rectangle URL
carpark_photo	string	Image URL of main car park entrance


⸻

6.4 openingHours Array

Each rule:

Field	Type	Req	Description
periodStart	string	Y	Start time "HH:MM"
periodEnd	string	Y	End time "HH:MM"
excludePublicHoliday	boolean	Y	Whether rule excludes public holidays
weekdays	string[]	Y	MON–SUN, PH

Example semantics:
	•	Rule 1: MON–FRI 19:00–07:00
	•	Rule 2: SAT, SUN, PH 07:00–07:00

⸻

6.5 gracePeriods Array

Field	Type	Req	Description
minutes	number	Y	Free parking duration in minutes
remark	string	N	Condition (e.g. non-resident, stage 4) in specified locale


⸻

6.6 heightLimits Array

Field	Type	Req	Description
height	number	N	Height limit in meters
remark	string	N	Remark text (e.g. “Private Car/Van”, “Lorry”)


⸻

6.7 facilities Array

Possible values:
	•	evCharger
	•	disabilities
	•	unloading
	•	washing
	•	valet-parking

⸻

6.8 paymentMethods Array

Possible values:
	•	cash
	•	octopus
	•	EPS
	•	visa
	•	master
	•	unionpay
	•	alipay
	•	autopay-station

⸻

7. Vehicle-Type Objects in Basic Info (privateCar, LGV, HGV, CV, coach, motorCycle)

Each of these (when present) contains:
	•	space
	•	spaceDIS
	•	spaceEV
	•	spaceUNL
	•	hourlyCharges
	•	dayNightParks
	•	monthlyCharges
	•	unloadings (not for motorCycle)
	•	privileges

7.1 Space Fields

Field	Type	Req	Description
space	number	Y	Total spaces (EV + non-EV)
spaceDIS	number	Y	Spaces for disabled persons (this vehicle type)
spaceEV	number	Y	EV-only spaces (this vehicle type)
spaceUNL	number	Y	Unloading spaces (this vehicle type)


⸻

7.2 hourlyCharges Array

Field	Type	Req	Description
type	string	Y	hourly or half-hourly
weekdays	string[]	Y	MON–SUN, PH
excludePublicHoliday	boolean	Y	Whether rule excludes public holidays
periodStart	string	Y	Start time "HH:MM"
periodEnd	string	Y	End time "HH:MM"
price	number	Y	Rate in HKD
usageThresholds	object[]	N	Per-usage thresholds
covered	string	Y	covered, semi-covered, open-air, mixed
remark	string	N	Condition text in locale

usageThresholds elements:

Field	Type	Req	Description
hours	number	Y	Hours threshold
price	number	Y	Price within threshold

Example:
	•	First 2 hours: $30 (per hour), then normal price afterward.

⸻

7.3 dayNightParks Array

Field	Type	Req	Description
type	string	Y	day-park, night-park, 6-hours-park, 12-hours-park, 24-hours-park
weekdays	string[]	Y	MON–SUN, PH
excludePublicHoliday	boolean	Y	Exclude public holidays
periodStart	string	Y	Start time
periodEnd	string	Y	End time
validUntil	string	Y	no-restrictions, same-day, following-day
validUntilEnd	string	N	End time limit (e.g. "24:00")
price	number	Y	Rate in HKD
covered	string	Y	covered, semi-covered, open-air, mixed
remark	string	N	Condition text


⸻

7.4 monthlyCharges Array

Field	Type	Req	Description
type	string	Y	monthly-park, monthly-day-park, monthly-night-park, bimonthly-*, quarterly-*, yearly-*
price	number	Y	Monthly/period charge in HKD
ranges	object[]	N	Time ranges for which plan applies
covered	string	Y	covered, semi-covered, open-air, mixed
reserved	string	Y	reserved or non-reserved
remark	string	N	Condition text

ranges elements:

Field	Type	Req	Description
weekdays	string[]	Y	MON–SUN, PH
excludePublicHoliday	boolean	Y	Whether rule excludes PH
periodStart	string	Y	Start time
periodEnd	string	Y	End time

Example:
	•	Mon–Fri 19:00–09:00
	•	Sat/Sun/PH 00:00–24:00

⸻

7.5 unloadings Array

Field	Type	Req	Description
type	string	Y	hourly or half-hourly
price	number	Y	Rate in HKD
usageThresholds	object[]	N	Threshold pricing (same schema as above)
remark	string	N	Condition text


⸻

7.6 privileges Array

Field	Type	Req	Description
weekdays	string[]	Y	MON–SUN, PH
excludePublicHoliday	boolean	Y	Excludes PH
periodStart	string	Y	Start time
periodEnd	string	Y	End time
description	string	Y	Description in specified locale


⸻

8. Data Dictionary — Parking Vacancy Data (data=vacancy)

8.1 Top-Level Vacancy Fields

#	Field	Type	Req	Description
1	park_Id	string	Y	System ID of car park
2	privateCar	object[]	N	Vacancy info for private cars
3	LGV	object[]	N	Vacancy info for light goods vehicles
4	HGV	object[]	N	Vacancy info for heavy goods vehicles
5	CV	object[]	N	Vacancy info for container vehicles
6	coach	object[]	N	Vacancy info for coaches
7	motorCycle	object[]	N	Vacancy info for motorcycles

Each vehicle-type array element contains:

Field	Type	Req	Description
vacancyDIS	number	N	Available disabled spaces (this vehicle type)
vacancyEV	number	N	Available EV spaces (this vehicle type)
vacancyUNL	number	N	Available unloading spaces (this vehicle type)
vacancy_type	string	Y	Vacancy reporting mode (A/B/C)
vacancy	number	Y	Available spaces (EV + non-EV)
lastupdate	string	Y	Last update from car park owner (YYYY-MM-DD HH:MM:SS)
category	string	N	HOURLY, DAILY, or MONTHLY


⸻

8.2 vacancy_type Semantics

vacancy_type describes how vacancy should be interpreted:
	•	Type A — Actual number
	•	vacancy >= 0 is the actual numeric count
	•	vacancy = 0 → Car park full (滿)
	•	vacancy = -1 → No data provided by car park operator
	•	Type B — Availability flag (no actual number)
	•	vacancy = 0 → Car park full (滿)
	•	vacancy = 1 → Spaces available (有車位)
	•	vacancy = -1 → No data provided
	•	Type C — Car park closed
	•	vacancy always 0 (關閉)

⸻


