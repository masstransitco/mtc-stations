
### Dataset: Locations and Occupancy Status of Non-Metered On-Street Parking Spaces Installed with Sensors

#### Data Type Overview

| Name                | Type           | Description                                                                                  |
|---------------------|---------------|----------------------------------------------------------------------------------------------|
| non_meter_parking_space | Spatial Layer  | Locations and occupancy status of non-metered on-street parking spaces installed with sensors |

#### Attribute Descriptions

| Field Name              | Data Type  | Null Option | Description                                                        |
|-------------------------|------------|-------------|--------------------------------------------------------------------|
| OBJECTID                | OID        | Not Null    | Unique identifier for the record                                   |
| FeatureID               | Long       | Nullable    | Feature identifier                                                 |
| ParkingSpaceId          | String     | Nullable    | This value specifies the metered parking space                     |
| Region                  | String     | Nullable    | Region name in English                                             |
| Region_tc               | String     | Nullable    | Region name in Traditional Chinese                                 |
| Region_sc               | String     | Nullable    | Region name in Simplified Chinese                                  |
| District                | String     | Nullable    | District name in English                                           |
| District_tc             | String     | Nullable    | District name in Traditional Chinese                               |
| District_sc             | String     | Nullable    | District name in Simplified Chinese                                |
| SubDistrict             | String     | Nullable    | Sub-District name in English                                       |
| SubDistrict_tc          | String     | Nullable    | Sub-District name in Traditional Chinese                           |
| SubDistrict_sc          | String     | Nullable    | Sub-District name in Simplified Chinese                            |
| Street                  | String     | Nullable    | Street name in English                                             |
| Street_tc               | String     | Nullable    | Street name in Traditional Chinese                                 |
| Street_sc               | String     | Nullable    | Street name in Simplified Chinese                                  |
| SectionOfStreet         | String     | Nullable    | Section of the Street in English where the parking meter is installed|
| SectionOfStreet_tc      | String     | Nullable    | Section of the Street in Traditional Chinese where installed        |
| SectionOfStreet_sc      | String     | Nullable    | Section of the Street in Simplified Chinese where installed         |
| VehicleType             | String     | Nullable    | Type of vehicle of the parking space                               |
| Occupancy_Status        | String     | Nullable    | Real-time occupancy status                                         |
| Shape                   | Geometry   | Not Null    | Geometry (coordinates) for the location of the parking space       |

#### Domain Coded Values for VehicleType

| Code | Description    |
|------|---------------|
| A    | Any Vehicles  |
| C    | Coach         |
| D    | Disabled      |

#### Additional Notes

- All multilingual fields are provided in English, Traditional Chinese, and Simplified Chinese as separate columns.
- The Shape field encodes the coordinates and geometry for each parking space site.
- Occupancy_Status provides sensor-detected real-time status for each parking space.
- This dataset is designed for spatial query support and integration with mapping/GIS solutions. 

***

This specification captures all relevant field definitions and dataset structure as described in your source and attachment[1].

Sources
[1] 1 Summary / 摘要 / 摘要 https://static.csdi.gov.hk/csdi-webpage/view/common/5a785e06aeaedd4e3b94eebb6aa81867567274d0ac04896327aa3f8c0ab82f40
