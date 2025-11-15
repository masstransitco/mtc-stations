# Parking Vacancy Data Quality Analysis

**Analysis Date:** 2025-11-15
**Data Period:** 2021-09-28 to 2025-11-15 (snapshot analysis)
**Status:** Pending Re-verification (check again in 3-7 days)

---

## Executive Summary

An analysis of the parking vacancy data collected from the Hong Kong Government API has identified **178 carpark/vehicle-type combinations** (44.2% of analyzed data) that are returning **constant, unchanging vacancy values** across multiple data collection cycles spanning 9+ hours.

This pattern strongly suggests:
1. **Stale data feeds** - Carpark operators not updating their systems
2. **Static/placeholder values** - Systems returning fixed values instead of real-time data
3. **Offline sensors** - Detection systems not functioning but API still returning cached values

---

## Analysis Methodology

### Data Set
- **Source:** `parking_vacancy_snapshots` table in Supabase PostgreSQL database
- **Filter Criteria:**
  - Only valid records (`is_valid = true`, i.e., `vacancy >= 0`)
  - Minimum 10 records per carpark/vehicle-type combination
  - Analysis period: November 14-15, 2025

### Detection Method
Identified carparks where:
```sql
COUNT(DISTINCT vacancy) = 1  -- Only one unique vacancy value
AND COUNT(*) > 10             -- Sufficient data points
AND STDDEV(vacancy) = 0       -- Zero variance
```

---

## Key Findings

### Overall Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total carpark/vehicle combinations analyzed** | 403 | 100% |
| **SUSPICIOUS (1 unique value)** | 178 | 44.2% |
| **Limited variation (2-5 unique values)** | 81 | 20.1% |
| **Healthy (6+ unique values)** | 144 | 35.7% |

### Breakdown by Vehicle Type

The issue affects all vehicle types:

| Vehicle Type | Suspicious Entries |
|--------------|-------------------|
| privateCar | 131 |
| motorCycle | 13 |
| LGV | 9 |
| HGV | 6 |
| coach | 2 |
| CV | 1 |

---

## Suspicious Carparks List

### Critical Cases - High Vacancy Constants (>20 spaces)

These large carparks report the same high vacancy for 9+ hours, which is statistically improbable:

| Park ID | Name | District | Constant Value | Records | Time Span |
|---------|------|----------|----------------|---------|-----------|
| tdc183p1 | Car Park at the park located east of Fan Kam Road | North | 131 | 69 | 9h 13m |
| tdc95p1 | Queensway Government Offices | Central & Western | 90 | 69 | 9h 14m |
| tdc58p1 | Wong Nai Chung Gap Children Playground | Wan Chai | 57 | 69 | 9h 12m |
| tdc8p11 | MTR Ocean Park Station Car Park | Southern | 36 | 69 | 9h 14m |
| 88 | Public Vehicle Parking, 8 Yan Yue Wai, Yau Tong | Kwun Tong District | 35 | 69 | 0h 0m ⚠️ |
| tdstt89 | Shek Kok Road | Sai Kung | 35 | 24 | 1h 14m |
| tdc74p6 | Tuen Mun Swimming Pool Car Park | Tuen Mun | 32 | 69 | 9h 0m |
| tdc10p1 | Sai Kung Government Offices Carpark | Sai Kung | 30 | 69 | 9h 14m |
| tdc74p13 | Kwong Fuk Park | Tai Po | 29 | 69 | 9h 14m |
| tdc74p2 | Tseung Kwan O Sports Ground | Sai Kung | 29 | 69 | 9h 14m |
| tdc81p5 | Tsing Yi Sports Ground and Swimming Pool Car Park | Kwai Tsing | 25 | 69 | 9h 13m |
| tdc55p1 | North Point Government Offices | Eastern | 20 | 69 | 9h 14m |
| 88 | Public Vehicle Parking, 8 Yan Yue Wai, Yau Tong (HGV) | Kwun Tong District | 20 | 69 | 0h 0m ⚠️ |

⚠️ **Note:** Time span of 0h indicates same timestamp repeatedly - highly suspicious

### Medium Impact - Government & Public Facilities

| Park ID | Name | District | Constant Value | Records |
|---------|------|----------|----------------|---------|
| 78 | Stelux House | Wong Tai Sin District | 18 | 69 |
| tdc124p1 | Chun Yeung Shopping Centre Car Park | Sha Tin | 11 | 23 |
| tdstt119 | Miu Wo Ngan Shu Street | Islands | 10 | 69 |
| tdc39p1 | Siu Sai Wan Sports Ground | Eastern | 9 | 69 |

### Housing Estate Carparks - Constant "1" Vacancy

**84 Housing Development Authority (HDA) carparks** (park_id pattern: `tdc14p*`) all report constant vacancy of **1 space** for 9+ hours:

**Example entries:**
- tdc14p1004 - Choi Ming Car Park 1 (Sai Kung)
- tdc14p1005 - Choi Ming Car Park 2 (Sai Kung)
- tdc14p1006 - Kin Ming Car Park A (Sai Kung)
- tdc14p1007 - Tong Ming Car Park (Sai Kung)
- tdc14p2101 - Chung On Car Park (Sha Tin)
- tdc14p3202 - Ka Tin Car Park (Sha Tin)
- tdc14p3435 - Tak Tin Car Park A (Kwun Tong)
- tdc14p4312 - Kwong Fuk Car Park (Tai Po)
- tdc14p5137 - Po Lam Car Park (Sai Kung)
- tdc14p6401 - Stanley Plaza Car Park (Southern)
- tdc14p7732 - Choi Wan Car Park A (Wong Tai Sin)
- tdc14p8424 - Homantin Car Park (Kowloon City)

[See full list in appendix](#appendix-complete-suspicious-carparks-list)

### Zero Vacancy Constants - Potentially Closed/Full

These carparks consistently report **0 vacancies**:

| Park ID | Name | District | Vehicle Type |
|---------|------|----------|--------------|
| tdc142p1 | Yan Tin Estate Carpark | Tuen Mun | privateCar, LGV, motorCycle |
| tdc14p1032 | Tsui Wan Car Park | Eastern | privateCar |
| tdc14p2121 | Choi Yuen Car Park D | North | privateCar |
| tdc14p5421 | Nam Cheong Car Park | Sham Shui Po | privateCar |
| tdc14p6640 | Lok Wah North Car Park A | Kwun Tong | privateCar |
| tdc166p3 | Phase 3 Carpark of Tin Ching Estate | Yuen Long | privateCar |
| tdc69p2 | Po Wing Road Sports Centre | North | privateCar |
| tdc74p7 | Yau Oi Sports Centre | Tuen Mun | privateCar |
| tdc81p2 | Kwai Chung Sports Ground | Kwai Tsing | privateCar |

### Historic/Stale Data Issues

**Critical - Very old data:**

| Park ID | Name | Last Update | Status |
|---------|------|-------------|--------|
| tdc37p1 | Tai Po Government Offices | 2021-09-28 | **Data from 4+ years ago!** |
| tdc20p1 | Hong Kong Wetland Park Car Park | 2023-05-21 | **Data from 2+ years ago!** |

---

## Pattern Analysis

### By Carpark Operator/Type

1. **Government Offices & Public Facilities** (12 carparks)
   - Pattern: High constant values (20-90 spaces)
   - Examples: Queensway Government Offices (90), North Point Government Offices (20)
   - **Hypothesis:** May have outdated integration or manual reporting systems

2. **Sports & Recreation Facilities** (8 carparks)
   - Pattern: Medium constant values (25-32 spaces)
   - Examples: Tuen Mun Swimming Pool (32), Tsing Yi Sports Ground (25)
   - **Hypothesis:** Facilities may have seasonal/static reporting

3. **HDA Housing Estate Carparks** (84 carparks, prefix `tdc14p*`)
   - Pattern: Constant value of "1" across all
   - Coverage: Sai Kung, Sha Tin, Kwun Tong, Tuen Mun, Wong Tai Sin, etc.
   - **Hypothesis:** Centralized system issue or placeholder value

4. **Commercial Buildings** (3 carparks)
   - Pattern: Medium constant values
   - Example: Stelux House (18)
   - **Hypothesis:** May not have real-time vacancy reporting

### Geographic Distribution

Districts with highest number of suspicious carparks:

1. **Wong Tai Sin** - 21 carparks (mostly HDA estates)
2. **Kwun Tong** - 19 carparks (mix of HDA and public facilities)
3. **Sha Tin** - 17 carparks (primarily HDA estates)
4. **Eastern** - 9 carparks
5. **Sai Kung** - 15 carparks (mostly HDA estates)

---

## Data Quality Impact

### On Map Display

**Current Impact:**
- 178 markers showing **potentially incorrect** vacancy data
- Users may navigate to carparks expecting availability that doesn't exist
- Undermines trust in real-time data accuracy

### On Analytics

- Historical trend analysis compromised for affected carparks
- Average vacancy calculations skewed
- Peak/off-peak analysis unreliable for these locations

---

## Recommended Actions

### Immediate (Within 24 hours)

1. ✅ **Document suspicious carparks** (completed - this document)
2. ⏳ **Add data quality flag** to database
   - Create view: `suspicious_carparks`
   - Flag these entries in `parking_vacancy_snapshots`
3. ⏳ **Update map UI** to visually distinguish suspicious data
   - Use different marker color (gray/orange)
   - Add disclaimer in InfoWindow: "⚠️ Data may be outdated"

### Short-term (3-7 days)

4. ⏳ **Re-analyze data** after monitoring period
   - Check if variance remains at zero
   - Confirm which carparks have genuinely static data
   - Update this document with findings

5. ⏳ **Create automated monitoring**
   - Daily check for new carparks with suspicious patterns
   - Alert when variance = 0 for 24+ hours
   - Track in `ingestion_quality_metrics` view

### Medium-term (1-2 weeks)

6. ⏳ **Filter suspicious carparks** from public display
   - Option 1: Exclude from API response by default
   - Option 2: Add `data_quality` field to API response
   - Option 3: Create separate "verified" vs "unverified" endpoints

7. ⏳ **Contact carpark operators** (if possible)
   - Focus on high-impact cases (131, 90, 57 space carparks)
   - Request data feed verification
   - Document operator responses

### Long-term (1+ months)

8. ⏳ **Implement data quality scoring**
   - Score based on: variance, update frequency, staleness
   - Display confidence level to users
   - Use for ranking/filtering in search results

---

## Re-verification Schedule

**Next Check Date:** 2025-11-22 (7 days from initial analysis)

### Criteria for Re-verification

For each suspicious carpark, check:
- [ ] Does variance remain at 0?
- [ ] Has the constant value changed at all?
- [ ] Is the timestamp updating?
- [ ] Compare variance over 7 days vs initial 9 hours

### Expected Outcomes

1. **Confirmed Stale:** Variance still 0 after 7 days → **Remove from map or flag clearly**
2. **False Positive:** Data now shows variation → **Reclassify as healthy**
3. **Partially Updated:** Some variation but still suspicious → **Keep monitoring**

---

## SQL Queries for Monitoring

### Check Current Status of Suspicious Carparks

```sql
SELECT
    park_id,
    vehicle_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT vacancy) as unique_values,
    ROUND(STDDEV(vacancy)::numeric, 2) as stddev,
    MIN(vacancy) as min_val,
    MAX(vacancy) as max_val,
    MAX(lastupdate) as latest_update
FROM parking_vacancy_snapshots
WHERE park_id IN (
    -- List of suspicious park_ids
    'tdc183p1', 'tdc95p1', 'tdc58p1', 'tdc8p11', '88'
    -- Add more as needed
)
AND ingested_at > NOW() - INTERVAL '7 days'
GROUP BY park_id, vehicle_type
ORDER BY stddev, park_id;
```

### Identify New Suspicious Carparks

```sql
SELECT
    park_id,
    vehicle_type,
    COUNT(*) as records,
    COUNT(DISTINCT vacancy) as unique_vals,
    MIN(vacancy) as constant_value
FROM parking_vacancy_snapshots
WHERE ingested_at > NOW() - INTERVAL '24 hours'
  AND is_valid = true
GROUP BY park_id, vehicle_type
HAVING COUNT(*) > 10
   AND COUNT(DISTINCT vacancy) = 1
ORDER BY constant_value DESC;
```

### Calculate Data Quality Score

```sql
WITH carpark_quality AS (
    SELECT
        park_id,
        vehicle_type,
        COUNT(DISTINCT vacancy) as variance_score,
        EXTRACT(EPOCH FROM (MAX(lastupdate) - MIN(lastupdate)))/3600 as hours_range,
        CASE
            WHEN MAX(lastupdate) > NOW() - INTERVAL '2 hours' THEN 10
            WHEN MAX(lastupdate) > NOW() - INTERVAL '6 hours' THEN 7
            WHEN MAX(lastupdate) > NOW() - INTERVAL '24 hours' THEN 4
            ELSE 0
        END as freshness_score
    FROM parking_vacancy_snapshots
    WHERE ingested_at > NOW() - INTERVAL '24 hours'
      AND is_valid = true
    GROUP BY park_id, vehicle_type
)
SELECT
    park_id,
    vehicle_type,
    variance_score,
    freshness_score,
    (variance_score + freshness_score) as total_quality_score,
    CASE
        WHEN (variance_score + freshness_score) >= 15 THEN 'GOOD'
        WHEN (variance_score + freshness_score) >= 8 THEN 'FAIR'
        ELSE 'POOR'
    END as quality_rating
FROM carpark_quality
ORDER BY total_quality_score DESC;
```

---

## Appendix: Complete Suspicious Carparks List

### All 178 Suspicious Entries

#### PrivateCar (131 entries)

**Constant Value: 131**
- tdc183p1 - Car Park at the park located east of Fan Kam Road (North)

**Constant Value: 90**
- tdc95p1 - Queensway Government Offices (Central & Western)

**Constant Value: 57**
- tdc58p1 - Wong Nai Chung Gap Children Playground (Wan Chai)

**Constant Value: 36**
- tdc8p11 - MTR Ocean Park Station Car Park (Southern)

**Constant Value: 35**
- 88 - Public Vehicle Parking, 8 Yan Yue Wai, Yau Tong (Kwun Tong District)
- tdstt89 - Shek Kok Road (Sai Kung)

**Constant Value: 32**
- tdc74p6 - Tuen Mun Swimming Pool Car Park (Tuen Mun)

**Constant Value: 30**
- tdc10p1 - Sai Kung Government Offices Carpark (Sai Kung)

**Constant Value: 29**
- tdc74p13 - Kwong Fuk Park (Tai Po)
- tdc74p2 - Tseung Kwan O Sports Ground (Sai Kung)

**Constant Value: 25**
- tdc81p5 - Tsing Yi Sports Ground and Swimming Pool Car Park (Kwai Tsing)

**Constant Value: 20**
- tdc55p1 - North Point Government Offices (Eastern)

**Constant Value: 18**
- 78 - Stelux House (Wong Tai Sin District)

**Constant Value: 11**
- tdc124p1 - Chun Yeung Shopping Centre Car Park (Sha Tin)

**Constant Value: 10**
- tdstt119 - Miu Wo Ngan Shu Street (Islands)

**Constant Value: 9**
- tdc39p1 - Siu Sai Wan Sports Ground (Eastern)

**Constant Value: 1** (84 HDA carparks)
- tdc14p1004 - Choi Ming Car Park 1 (Sai Kung)
- tdc14p1005 - Choi Ming Car Park 2 (Sai Kung)
- tdc14p1006 - Kin Ming Car Park A (Sai Kung)
- tdc14p1007 - Tong Ming Car Park (Sai Kung)
- tdc14p1012 - Sheung Tak Car Park B (Sai Kung)
- tdc14p1015 - Oi Tung Car Park (Eastern)
- tdc14p1016 - Yiu Tung Car Park 1 (Eastern)
- tdc14p1017 - Hing Tung Car Park (Eastern)
- tdc14p1030 - Siu Sai Wan Phase 3 Car Park (Eastern)
- tdc14p1031 - Siu Sai Wan Phase 1 Car Park (Eastern)
- tdc14p1034 - Hing Wah Car Park B (Eastern)
- tdc14p1037 - Yiu Tung Car Park 2 (Eastern)
- tdc14p2101 - Chung On Car Park (Sha Tin)
- tdc14p2104 - Heng On Car Park (Sha Tin)
- tdc14p2106 - Yiu On Car Park (Sha Tin)
- tdc14p2116 - Cheung Wah Car Park A (North)
- tdc14p2117 - Cheung Wah Car Park B (North)
- tdc14p3201 - Hin Keng Car Park (Sha Tin)
- tdc14p3202 - Ka Tin Car Park (Sha Tin)
- tdc14p3204 - Lung Hang A Car Park (Sha Tin)
- tdc14p3206 - Sun Chui Car Park B (Sha Tin)
- tdc14p3216 - Mei Lam Car Park (Sha Tin)
- tdc14p3303 - Tin Wah Car Park (Yuen Long)
- tdc14p3304 - T Town South Car Park (Yuen Long)
- tdc14p3306 - T Town North Car Park (Yuen Long)
- tdc14p3309 - Tin Chak Car Park (Yuen Long)
- tdc14p3311 - Tin Yat Car Park (Yuen Long)
- tdc14p3431 - Hong Pak Car Park (Kwun Tong)
- tdc14p3432 - Hong Shui Car Park (Kwun Tong)
- tdc14p3433 - Ko Chun Car Park (Kwun Tong)
- tdc14p3435 - Tak Tin Car Park A (Kwun Tong)
- tdc14p3436 - Tak Tin Car Park B (Kwun Tong)
- tdc14p3441 - Kai Tin Car Park A (Kwun Tong)
- tdc14p3443 - Ping Tin Phase 2 Car Park (Kwun Tong)
- tdc14p3444 - Ping Tin Phase 4 Car Park (Kwun Tong)
- tdc14p3445 - Hong Yat Car Park (Kwun Tong)
- tdc14p3512 - Leung King Car Park (Tuen Mun)
- tdc14p3514 - Tin King Car Park (Tuen Mun)
- tdc14p3519 - Kin Sang Car Park (Tuen Mun)
- tdc14p3520 - Tai Hing - Car Park H (Tuen Mun)
- tdc14p3521 - Tai Hing - Car Park D (Tuen Mun)
- tdc14p3522 - Tai Hing - Car Park C (Tuen Mun)
- tdc14p3527 - Fu Tai Car Park (Tuen Mun)
- tdc14p3554 - Kai Tin Car Park B (Kwun Tong)
- tdc14p4220 - Yu Chui Car Park B (Sha Tin)
- tdc14p4222 - Kwong Yuen Car Park A (Sha Tin)
- tdc14p4223 - Lek Yuen Car Park (Sha Tin)
- tdc14p4227 - Wo Che Car Park F (Sha Tin)
- tdc14p4237 - Long Ping Car Park D (Yuen Long)
- tdc14p4239 - Tin Shing Car Park A (Yuen Long)
- tdc14p4243 - Tin Yiu Car Park (Yuen Long)
- tdc14p4246 - Tin Tsz Car Park (Yuen Long)
- tdc14p4258 - Sha Kok Car Park 2 (Sha Tin)
- tdc14p4312 - Kwong Fuk Car Park (Tai Po)
- tdc14p4327 - Tai Yuen Car Park A (Tai Po)
- tdc14p4330 - Fu Heng Car Park A (Tai Po)
- tdc14p4332 - Lok Fu UNY Car Park (Wong Tai Sin)
- tdc14p4334 - Lok Fu Market Car Park (Wong Tai Sin)
- tdc14p4336 - Hong Keung Car Park (Wong Tai Sin)
- tdc14p4337 - Tung Tau II Car Park A (Wong Tai Sin)
- tdc14p4352 - Lok Fu Estate Car Park (Wong Tai Sin)
- tdc14p5128 - TKO Gateway Car Park West (Sai Kung)
- tdc14p5132 - TKO Gateway Car Park South (Sai Kung)
- tdc14p5135 - Yan Ming Court Car Park (Sai Kung)
- tdc14p5136 - Ying Ming Court Car Park (Sai Kung)
- tdc14p5137 - Po Lam Car Park (Sai Kung)
- tdc14p5406 - Wah Lai Car Park (Kwai Tsing)
- tdc14p5528 - Chuk Yuen (S) Car Park (Wong Tai Sin)
- tdc14p5534 - Temple Mall South Car Park A (Wong Tai Sin)
- tdc14p5718 - Ning Fung Car Park (Kwai Tsing)
- tdc14p5727 - Yin Lai Car Park (Kwai Tsing)
- tdc14p5904 - Ying Fuk Car Park (Wong Tai Sin)
- tdc14p6401 - Stanley Plaza Car Park (Southern)
- tdc14p6602 - Sau Mau Ping Phase 15 Car Park (Kwun Tong)
- tdc14p6603 - Sau Mau Ping Phase 1 Car Park (Kwun Tong)
- tdc14p6604 - Sau Mau Ping Phase 3 Car Park (Kwun Tong)
- tdc14p6605 - Po Tat Car Park A (Kwun Tong)
- tdc14p6606 - Po Tat Car Park B and C (Kwun Tong)
- tdc14p6607 - Hiu Lai Car Park (Kwun Tong)
- tdc14p6608 - Cheung Fat Car Park (Kwai Tsing)
- tdc14p6609 - Ching Wang Court Car Park (Kwai Tsing)
- tdc14p6610 - Cheung On Phase 1 Car Park (Kwai Tsing)
- tdc14p6611 - Cheung On Phase 2 Car Park (Kwai Tsing)
- tdc14p6620 - Ching Wah Car Park (Kwai Tsing)
- tdc14p6639 - Lok Wah South Car Park (Kwun Tong)
- tdc14p6641 - Lok Wah North Car Park B (Kwun Tong)
- tdc14p6643 - Upper Ngau Tau Kok Car Park (Kwun Tong)
- tdc14p6645 - Cheung Wang Car Park (Kwai Tsing)
- tdc14p6713 - Kwai Hong Car Park (Kwai Tsing)
- tdc14p6728 - Yat Tung Car Park 2 & 3 (Sin Yat) (Islands)
- tdc14p6729 - Yat Tung Car Park 1 (Islands)
- tdc14p6730 - Fu Tung Car Park A (Islands)
- tdc14p7542 - Tsui Ping North Car Park 1 (Kwun Tong)
- tdc14p7543 - Tsui Ping South Car Park (Kwun Tong)
- tdc14p7545 - Po Pui Car Park (Kwun Tong)
- tdc14p7623 - Tsz Oi Car Park (Wong Tai Sin)
- tdc14p7628 - Tsz Man Car Park (Wong Tai Sin)
- tdc14p7629 - Fung Tak Car Park A (Wong Tai Sin)
- tdc14p7632 - Tsz Wan Shan SC Car Park B (Wong Tai Sin)
- tdc14p7633 - Tsz Wan Shan SC Car Park C (Wong Tai Sin)
- tdc14p7636 - Tsz Wan Shan SC Car Park D (Wong Tai Sin)
- tdc14p7645 - Fung Lai Car Park (Wong Tai Sin)
- tdc14p7646 - King Lai Car Park (Wong Tai Sin)
- tdc14p7732 - Choi Wan Car Park A (Wong Tai Sin)
- tdc14p7733 - Choi Wan Car Park B & C (Wong Tai Sin)
- tdc14p7737 - Shun Lee (Jordan Valley Park) Car Park (Kwun Tong)
- tdc14p7739 - Shun Lee Fresh Market Car Park (Kwun Tong)
- tdc14p7740 - Shun Lee (Shopping Centre) Car Park (Kwun Tong)
- tdc14p7742 - Shun On Car Park (Kwun Tong)
- tdc14p8423 - Oi Man Car Park (Kowloon City)
- tdc14p8424 - Homantin Car Park (Kowloon City)
- tdc14p8502 - Butterfly Car Park (Tuen Mun)
- tdc2p4 - AIRPORT CAR PARK 4 (Islands)
- tdc5p3 - Wu Chung House (Wan Chai)
- tdc6p15 - Lei Yue Mun Estate (Kwun Tong)

**Constant Value: 0** (11 carparks)
- tdc142p1 - Yan Tin Estate Carpark (Tuen Mun)
- tdc14p1032 - Tsui Wan Car Park (Eastern)
- tdc14p2121 - Choi Yuen Car Park D (North)
- tdc14p5421 - Nam Cheong Car Park (Sham Shui Po)
- tdc14p6640 - Lok Wah North Car Park A (Kwun Tong)
- tdc166p3 - Phase 3 Carpark of Tin Ching Estate (Yuen Long)
- tdc20p1 - Hong Kong Wetland Park Car Park (Yuen Long) - **DATA FROM 2023!**
- tdc37p1 - Tai Po Government Offices (Tai Po) - **DATA FROM 2021!**
- tdc69p2 - Po Wing Road Sports Centre (North)
- tdc6p19 - Hoi Lai Estate Car Park (Sham Shui Po)
- tdc74p7 - Yau Oi Sports Centre (Tuen Mun)
- tdc81p2 - Kwai Chung Sports Ground (Kwai Tsing)

#### MotorCycle (13 entries)
- tdcp9 - Shau Kei Wan Car Park (Eastern) - Constant: 7
- tdc48p2 - Lung Cheung Road Lookout (Sham Shui Po) - Constant: 4
- tdc58p3 - Shek Kip Mei Park Tennis Court (Sham Shui Po) - Constant: 4
- 27 - Yau Lai Shopping Centre Carpark (Kwun Tong District) - Constant: 2
- tdstt132 - Hoi Tou Car Park (Tuen Mun) - Constant: 2
- tdc142p1 - Yan Tin Estate Carpark (Tuen Mun) - Constant: 1
- tdc183p1 - Car Park at the park located east of Fan Kam Road (North) - Constant: 1
- tdc117p1 - Hong Kong Palace Museum Car Park (Yau Tsim Mong) - Constant: 0
- tdc124p1 - Chun Yeung Shopping Centre Car Park (Sha Tin) - Constant: 0
- tdc126p1 - Ping Yan Carpark (Yuen Long) - Constant: 0
- tdc150p1 - Ying Tung Estate Carpark (Islands) - Constant: 0
- tdc17p2 - Art Park Car Park (Yau Tsim Mong) - Constant: 0
- tdc32p2 - Wah Fu (II) Estate (Southern) - Constant: 0
- tdc52p1 - M+ Car Park (Yau Tsim Mong) - Constant: 0
- tdcp7 - Kennedy Town Car Park (Central & Western) - Constant: 0
- tdstt90 - Tung Chau Street (Sham Shui Po) - Constant: 0

#### LGV (9 entries)
- 88 - Public Vehicle Parking, 8 Yan Yue Wai, Yau Tong (Kwun Tong District) - Constant: 10
- tdc76p3 - Po Kong Village Road Park (Wong Tai Sin) - Constant: 1
- tdc124p1 - Chun Yeung Shopping Centre Car Park (Sha Tin) - Constant: 0
- tdc140p1 - Hung Hom Estate Phase II Carpark (Kowloon City) - Constant: 0
- tdc142p1 - Yan Tin Estate Carpark (Tuen Mun) - Constant: 0
- tdc150p1 - Ying Tung Estate Carpark (Islands) - Constant: 0
- tdc32p2 - Wah Fu (II) Estate (Southern) - Constant: 0
- tdstt118 - Kwong Fuk Carpark Tai Po Dai Wah Street (Tai Po) - Constant: 0
- tdstt65 - Fo Shing Road Car Park (Tai Po) - Constant: 0

#### HGV (6 entries)
- 88 - Public Vehicle Parking, 8 Yan Yue Wai, Yau Tong (Kwun Tong District) - Constant: 20
- tdc48p2 - Lung Cheung Road Lookout (Sham Shui Po) - Constant: 2
- 78 - Stelux House (Wong Tai Sin District) - Constant: 1
- tdc32p2 - Wah Fu (II) Estate (Southern) - Constant: 0
- tdstt118 - Kwong Fuk Carpark Tai Po Dai Wah Street (Tai Po) - Constant: 0
- tdstt15 - San On Street (Tuen Mun) - Constant: 0
- tdstt90 - Tung Chau Street (Sham Shui Po) - Constant: 0

#### Coach (2 entries)
- tdc32p2 - Wah Fu (II) Estate (Southern) - Constant: 0
- tdstt118 - Kwong Fuk Carpark Tai Po Dai Wah Street (Tai Po) - Constant: 0

#### CV (1 entry)
- tdc37p1 - Tai Po Government Offices (Tai Po) - Constant: 0 - **DATA FROM 2021!**

---

## Document Metadata

**Created by:** Automated Analysis
**Source Code:** `/docs/vacancy-data-quality-analysis.md`
**Related Documentation:**
- [Data Pipeline Documentation](./data-pipeline.md)
- [Parking Map Frontend](./parking-map.md)

**Revision History:**
- 2025-11-15: Initial analysis and documentation
- 2025-11-22: [PENDING] Re-verification results

---

**Status:** 🔴 ACTIVE MONITORING - Check back on 2025-11-22
