# MARTA GTFS-RT: Vehicle Positions vs Trip Updates Analysis

> Generated: 2/12/2026, 9:15:05 PM
> Investigation: 6 samples at 60-second intervals

## Executive Summary

This investigation compares MARTA's two GTFS-RT feeds to understand why the Trip Updates 
feed consistently contains more entries than the Vehicle Positions feed.

## Aggregate Statistics (6 samples over 5 minutes)

| Metric | Min | Max | Avg |
|--------|-----|-----|-----|
| Vehicle Positions | 175 | 176 | 175 |
| Trip Updates | 388 | 397 | 395 |
| TU/VP Ratio | 2.22x | 2.27x | 2.25x |

### Per-Route Consistency
| Route | Avg VP Vehicles | Avg TU Trips | Avg TU/VP | Avg Future Trips | Avg No-Vehicle Trips |
|-------|-----------------|--------------|-----------|------------------|---------------------|
| 32 | 2.0 | 4.0 | 2.00x | 2.0 | 0.0 |
| 21 | 3.0 | 6.0 | 2.00x | 2.0 | 0.0 |
| 39 | 4.0 | 11.0 | 2.75x | 3.0 | 5.0 |
| 4 | 1.0 | 1.0 | 1.00x | 1.0 | 0.0 |

### Mismatch Breakdown (Last Sample)
- Total VP entries: 175
- Total TU entries: 388
- **Difference: 213 extra TU entries**
- TU entries with NO vehicle ID assigned: 96
- TU entries with vehicle NOT in VP: 0
- Extra TU entries from multi-trip vehicles: 122
- Trips with predictions 30+ min in future: 59


---

## Raw Sample Data

### Sample at 9:10:04 PM
- VP feed timestamp: 9:10:05 PM
- TU feed timestamp: 9:09:35 PM
- Total vehicles in VP feed: **176**
- Total trips in TU feed: **397**
- Overall ratio TU/VP: **2.26x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **176**
- Unique vehicle IDs in TU: **171**
- TU trips with NO vehicle ID: **103**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **5**
- Vehicles with MULTIPLE trip updates: **123**

<details><summary>TU trips with no vehicle (103)</summary>

- 10975356 (route 116, start 21:15:00)
- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10929570 (route 34, start 21:12:00)
- 10921389 (route 15, start 21:15:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929599 (route 34, start 21:15:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11004545 (route 865, start 21:12:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- ... and 73 more
</details>

<details><summary>Vehicles with multiple TU entries (123)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2308**: 10959614 (start 20:25:00, 3 stops), 10972047 (start 21:28:00, 77 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 12 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 48 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994224 (start 20:10:00, 16 stops), 10994139 (start 21:10:00, 67 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 35 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 45 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2380**: 10990319 (start 20:50:00, 14 stops), 10939093 (start 21:35:00, 41 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 33 stops), 10931061 (start 21:42:00, 35 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 63 | 9:08:01 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 50 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 44 | 9:03:35 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:56 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 12 | 9:09:28 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 41 | 9:00:04 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:35 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:46:57 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:06:57 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:35:58 PM | 21:35:00 | 🔮 |


---

### Sample at 9:11:05 PM
- VP feed timestamp: 9:11:05 PM
- TU feed timestamp: 9:11:05 PM
- Total vehicles in VP feed: **175**
- Total trips in TU feed: **397**
- Overall ratio TU/VP: **2.27x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **175**
- Unique vehicle IDs in TU: **170**
- TU trips with NO vehicle ID: **103**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **5**
- Vehicles with MULTIPLE trip updates: **124**

<details><summary>TU trips with no vehicle (103)</summary>

- 10975356 (route 116, start 21:15:00)
- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10921389 (route 15, start 21:15:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929599 (route 34, start 21:15:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11004545 (route 865, start 21:12:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- 11003463 (route 850, start 23:40:00)
- ... and 73 more
</details>

<details><summary>Vehicles with multiple TU entries (124)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2308**: 10959614 (start 20:25:00, 3 stops), 10972047 (start 21:28:00, 77 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 11 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 48 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994139 (start 21:10:00, 67 stops), 10994192 (start 22:10:00, 72 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 33 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 45 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2380**: 10990319 (start 20:50:00, 14 stops), 10939093 (start 21:35:00, 41 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 30 stops), 10931061 (start 21:42:00, 35 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 63 | 9:08:01 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 50 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 35 | 9:10:02 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:55 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 11 | 9:13:00 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 31 | 9:10:22 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:35 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:45:34 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:05:34 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:35:59 PM | 21:35:00 | 🔮 |


---

### Sample at 9:12:05 PM
- VP feed timestamp: 9:12:05 PM
- TU feed timestamp: 9:12:05 PM
- Total vehicles in VP feed: **175**
- Total trips in TU feed: **397**
- Overall ratio TU/VP: **2.27x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **175**
- Unique vehicle IDs in TU: **170**
- TU trips with NO vehicle ID: **101**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **5**
- Vehicles with MULTIPLE trip updates: **126**

<details><summary>TU trips with no vehicle (101)</summary>

- 10975356 (route 116, start 21:15:00)
- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10921389 (route 15, start 21:15:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929599 (route 34, start 21:15:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- 11003463 (route 850, start 23:40:00)
- 10933805 (route 40, start 21:40:00)
- ... and 71 more
</details>

<details><summary>Vehicles with multiple TU entries (126)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2308**: 10959614 (start 20:25:00, 3 stops), 10972047 (start 21:28:00, 77 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 10 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 48 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994139 (start 21:10:00, 67 stops), 10994192 (start 22:10:00, 72 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 33 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 45 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2380**: 10990319 (start 20:50:00, 14 stops), 10939093 (start 21:35:00, 41 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 30 stops), 10931061 (start 21:42:00, 35 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 63 | 9:08:01 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 50 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 35 | 9:10:02 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:55 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 10 | 9:12:02 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 31 | 9:10:22 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:35 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:45:34 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:05:34 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:35:59 PM | 21:35:00 | 🔮 |


---

### Sample at 9:13:05 PM
- VP feed timestamp: 9:13:05 PM
- TU feed timestamp: 9:13:05 PM
- Total vehicles in VP feed: **175**
- Total trips in TU feed: **395**
- Overall ratio TU/VP: **2.26x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **175**
- Unique vehicle IDs in TU: **169**
- TU trips with NO vehicle ID: **100**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **6**
- Vehicles with MULTIPLE trip updates: **126**

<details><summary>TU trips with no vehicle (100)</summary>

- 10975356 (route 116, start 21:15:00)
- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10921389 (route 15, start 21:15:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929599 (route 34, start 21:15:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- 11003463 (route 850, start 23:40:00)
- 10933805 (route 40, start 21:40:00)
- ... and 70 more
</details>

<details><summary>Vehicles with multiple TU entries (126)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2308**: 10959614 (start 20:25:00, 3 stops), 10972047 (start 21:28:00, 77 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 7 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 48 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994139 (start 21:10:00, 67 stops), 10994192 (start 22:10:00, 72 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 32 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 45 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 30 stops), 10931061 (start 21:42:00, 35 stops)
- **3509**: 10936620 (start 10:00:00, 42 stops), 10936540 (start 10:36:00, 50 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 54 | 9:13:46 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 50 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 35 | 9:10:02 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:55 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 7 | 9:13:19 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 31 | 9:10:22 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:35 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:45:34 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:05:34 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:35:59 PM | 21:35:00 | 🔮 |


---

### Sample at 9:14:05 PM
- VP feed timestamp: 9:14:05 PM
- TU feed timestamp: 9:14:05 PM
- Total vehicles in VP feed: **175**
- Total trips in TU feed: **393**
- Overall ratio TU/VP: **2.25x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **175**
- Unique vehicle IDs in TU: **168**
- TU trips with NO vehicle ID: **100**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **7**
- Vehicles with MULTIPLE trip updates: **125**

<details><summary>TU trips with no vehicle (100)</summary>

- 10975356 (route 116, start 21:15:00)
- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10921408 (route 15, start 21:26:00)
- 10921389 (route 15, start 21:15:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929599 (route 34, start 21:15:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- 11003463 (route 850, start 23:40:00)
- ... and 70 more
</details>

<details><summary>Vehicles with multiple TU entries (125)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2308**: 10959614 (start 20:25:00, 3 stops), 10972047 (start 21:28:00, 77 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 6 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 31 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994139 (start 21:10:00, 67 stops), 10994192 (start 22:10:00, 72 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 32 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 45 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 30 stops), 10931061 (start 21:42:00, 35 stops)
- **3509**: 10936620 (start 10:00:00, 42 stops), 10936540 (start 10:36:00, 50 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 54 | 9:13:46 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 50 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 35 | 9:10:02 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:55 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 6 | 9:14:34 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 31 | 9:10:22 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:35 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:45:34 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:05:34 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:35:59 PM | 21:35:00 | 🔮 |


---

### Sample at 9:15:05 PM
- VP feed timestamp: 9:15:05 PM
- TU feed timestamp: 9:15:05 PM
- Total vehicles in VP feed: **175**
- Total trips in TU feed: **388**
- Overall ratio TU/VP: **2.22x**

#### Global Cross-Reference
- Unique vehicle IDs in VP: **175**
- Unique vehicle IDs in TU: **170**
- TU trips with NO vehicle ID: **96**
- TU vehicles NOT in VP feed: **0**
- VP vehicles NOT in any TU: **5**
- Vehicles with MULTIPLE trip updates: **122**

<details><summary>TU trips with no vehicle (96)</summary>

- 10951543 (route 78, start 21:20:00)
- 10965506 (route 95, start 21:23:00)
- 10965651 (route 95, start 22:00:00)
- 10940378 (route 55, start 22:00:00)
- 10933054 (route 39, start 21:55:00)
- 10977536 (route 119, start 21:30:00)
- 10959575 (route 86, start 21:20:00)
- 10959611 (route 86, start 22:25:00)
- 10976703 (route 117, start 21:34:00)
- 10972121 (route 111, start 22:00:00)
- 10921408 (route 15, start 21:26:00)
- 10998972 (route 193, start 21:25:00)
- 10998997 (route 193, start 22:41:00)
- 10964027 (route 94, start 21:25:00)
- 10963971 (route 94, start 22:00:00)
- 10964029 (route 94, start 22:45:00)
- 10963973 (route 94, start 23:20:00)
- 10964032 (route 94, start 00:05:00)
- 10929571 (route 34, start 21:52:00)
- 10929601 (route 34, start 22:35:00)
- 10929573 (route 34, start 23:12:00)
- 10929603 (route 34, start 23:55:00)
- 11003462 (route 850, start 21:40:00)
- 11003474 (route 850, start 22:10:00)
- 11004563 (route 865, start 22:50:00)
- 11004543 (route 865, start 23:12:00)
- 11003463 (route 850, start 23:40:00)
- 10933805 (route 40, start 21:40:00)
- 10933868 (route 40, start 22:25:00)
- 10972999 (route 114, start 21:50:00)
- ... and 66 more
</details>

<details><summary>Vehicles with multiple TU entries (122)</summary>

- **2301**: 10921550 (start 15:15:00, 74 stops), 10921365 (start 16:06:00, 74 stops)
- **2304**: 10921409 (start 20:46:00, 37 stops), 10921515 (start 21:40:00, 67 stops)
- **2309**: 10969166 (start 09:25:00, 66 stops), 10969224 (start 10:30:00, 87 stops)
- **2313**: 10932927 (start 20:45:00, 5 stops), 10933053 (start 21:35:00, 42 stops)
- **2325**: 10997853 (start 20:45:00, 31 stops), 10997797 (start 21:32:00, 49 stops)
- **2326**: 10921396 (start 16:31:00, 56 stops), 10921551 (start 17:30:00, 68 stops)
- **2327**: 10974300 (start 20:30:00, 9 stops), 10975254 (start 21:27:00, 56 stops)
- **2333**: 10994139 (start 21:10:00, 67 stops), 10994192 (start 22:10:00, 72 stops)
- **2335**: 10998976 (start 20:25:00, 23 stops), 10998998 (start 21:41:00, 73 stops)
- **2337**: 10993076 (start 20:40:00, 31 stops), 10993027 (start 21:17:00, 61 stops)
- **2339**: 10962278 (start 20:35:00, 31 stops), 10962192 (start 21:26:00, 54 stops)
- **2341**: 10954299 (start 20:48:00, 26 stops), 10954258 (start 21:50:00, 42 stops)
- **2342**: 10940453 (start 20:26:00, 18 stops), 10940377 (start 21:30:00, 62 stops)
- **2352**: 10943408 (start 11:10:00, 74 stops), 10943341 (start 12:02:00, 76 stops)
- **2376**: 10910343 (start 20:54:00, 20 stops), 10910371 (start 21:40:00, 38 stops)
- **2382**: 10931050 (start 14:16:00, 34 stops), 10931106 (start 15:05:00, 34 stops)
- **2383**: 10960507 (start 20:50:00, 24 stops), 10960593 (start 21:58:00, 51 stops)
- **2384**: 10931115 (start 21:05:00, 30 stops), 10931061 (start 21:42:00, 35 stops)
- **3509**: 10936620 (start 10:00:00, 42 stops), 10936540 (start 10:36:00, 50 stops)
- **3511**: 10993075 (start 21:10:00, 55 stops), 10993026 (start 21:47:00, 61 stops)
</details>

#### Route 32
| Metric | Count |
|--------|-------|
| Vehicles in VP | 2 |
| Trips in VP | 2 |
| Trips in TU | 4 |
| Unique vehicles in TU | 2 |
| TU trips WITH vehicle ID | 4 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 2 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10928557... | 4612 | ✅ | ✅ | 5 | 9:08:23 PM | 20:25:00 |  |
| 10928558... | 3734 | ✅ | ✅ | 54 | 9:13:31 PM | 21:05:00 |  |
| 10928525... | 4612 | ❌ | ✅ | 68 | 9:32:00 PM | 21:32:00 | 🔮 |
| 10928526... | 3734 | ❌ | ✅ | 68 | 10:12:00 PM | 22:12:00 | 🔮 |

**Multi-trip vehicles on route 32:**
- Vehicle 3734 has 2 trips: 10928558, 10928526
- Vehicle 4612 has 2 trips: 10928557, 10928525

#### Route 21
| Metric | Count |
|--------|-------|
| Vehicles in VP | 3 |
| Trips in VP | 3 |
| Trips in TU | 6 |
| Unique vehicles in TU | 3 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 0 |
| TU trips NOT in VP | 3 |
| Future trips (>10min out) | 2 |
| Multi-trip vehicles | 3 |
| TU/VP ratio | 2.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10923830... | 4618 | ✅ | ✅ | 48 | n/a | 19:10:00 |  |
| 10923719... | 4618 | ❌ | ✅ | 54 | n/a | 20:25:00 |  |
| 10923834... | 4719 | ✅ | ✅ | 31 | 9:07:55 PM | 20:40:00 |  |
| 10923720... | 4713 | ✅ | ✅ | 35 | 9:10:00 PM | 20:55:00 |  |
| 10923836... | 4713 | ❌ | ✅ | 69 | 9:40:50 PM | 21:40:00 | 🔮 |
| 10923722... | 4719 | ❌ | ✅ | 54 | 9:55:40 PM | 21:55:00 | 🔮 |

**Multi-trip vehicles on route 21:**
- Vehicle 4618 has 2 trips: 10923830, 10923719
- Vehicle 4713 has 2 trips: 10923720, 10923836
- Vehicle 4719 has 2 trips: 10923834, 10923722

#### Route 39
| Metric | Count |
|--------|-------|
| Vehicles in VP | 4 |
| Trips in VP | 4 |
| Trips in TU | 11 |
| Unique vehicles in TU | 4 |
| TU trips WITH vehicle ID | 6 |
| TU trips WITHOUT vehicle ID | 5 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 8 |
| Future trips (>10min out) | 3 |
| Multi-trip vehicles | 2 |
| TU/VP ratio | 2.75x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10933052... | 2431 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10932938... | ??? | ❌ | ✅ | 44 | n/a | 00:25:00 |  |
| 10933064... | ??? | ❌ | ✅ | 42 | n/a | 01:15:00 |  |
| 10932927... | 2313 | ✅ | ✅ | 5 | 9:14:59 PM | 20:45:00 |  |
| 10933051... | 3665 | ✅ | ✅ | 31 | 9:10:25 PM | 20:55:00 |  |
| 10932928... | 3679 | ✅ | ✅ | 43 | n/a | 21:05:00 |  |
| 10933053... | 2313 | ❌ | ✅ | 42 | 9:36:37 PM | 21:35:00 | 🔮 |
| 10932930... | 3665 | ❌ | ✅ | 44 | 9:45:46 PM | 21:45:00 | 🔮 |
| 10933054... | ??? | ❌ | ✅ | 42 | n/a | 21:55:00 |  |
| 10932931... | 2431 | ❌ | ✅ | 44 | 10:05:46 PM | 22:05:00 | 🔮 |
| 10932933... | ??? | ❌ | ✅ | 44 | n/a | 22:45:00 |  |
| 10933059... | ??? | ❌ | ✅ | 42 | n/a | 23:35:00 |  |

**Multi-trip vehicles on route 39:**
- Vehicle 2313 has 2 trips: 10932927, 10933053
- Vehicle 3665 has 2 trips: 10933051, 10932930

#### Route 4
| Metric | Count |
|--------|-------|
| Vehicles in VP | 1 |
| Trips in VP | 1 |
| Trips in TU | 1 |
| Unique vehicles in TU | 1 |
| TU trips WITH vehicle ID | 1 |
| TU trips WITHOUT vehicle ID | 0 |
| VP trips NOT in TU | 1 |
| TU trips NOT in VP | 1 |
| Future trips (>10min out) | 1 |
| Multi-trip vehicles | 0 |
| TU/VP ratio | 1.00x |

| Trip ID | Vehicle | In VP? | In TU? | TU Stops | 1st Prediction | Start Time | Future? |
|---------|---------|--------|--------|----------|----------------|------------|---------|
| 10913187... | 4608 | ✅ | ❌ | 0 | n/a | ??? |  |
| 10913097... | 4697 | ❌ | ✅ | 41 | 9:36:00 PM | 21:35:00 | 🔮 |


---

## Findings & Conclusions

### The Core Question: Why More Trip Updates Than Vehicle Positions?

Based on 6 samples over 5 minutes, the Trip Updates feed **consistently** has ~2.25x more 
entries than the Vehicle Positions feed (388-397 TU vs 175-176 VP). This ratio was rock-stable 
across all samples. The 213 extra TU entries break down into **two distinct categories**:

#### Category 1: Multi-Trip Vehicles (122 extra entries, ~57% of the gap)

This is the **dominant** source of the mismatch. MARTA's prediction system assigns each active 
vehicle predictions for **both its current trip AND its next scheduled trip**. 

**Concrete example from Route 32:**
- Vehicle **4612** is physically on trip `10928557` (started 20:25, VP shows position ✅)
- BUT TU also contains trip `10928525` (starts 21:32, 🔮 future) assigned to vehicle 4612
- That's 2 TU entries for 1 VP entry

This pattern was universal: **123-124 of 175 active vehicles** had exactly 2 TU entries each. 
That means ~70% of all buses on the road generate a "phantom" extra TU entry for their next run.

**This is real, useful data** — it tells riders "after this bus finishes its current run, 
it will start route X at time Y." It's not ghost data.

#### Category 2: Unassigned Future Trips (96 entries, ~45% of the gap)

These are trip updates with **no vehicle ID at all**. They represent scheduled service that 
MARTA knows will happen but hasn't assigned a specific bus to yet.

**Concrete example from Route 39:**
- Trip `10932938` starts at 00:25 (after midnight) — no vehicle assigned
- Trip `10933064` starts at 01:15 — no vehicle assigned  
- These are real scheduled trips, but the bus won't be assigned until closer to departure

These trips often had start times hours into the future (some as far out as midnight/1AM when 
sampled at 9PM). They include full stop-time predictions but no real-time arrival times 
(showing `n/a` for first prediction).

#### Category 3: VP-Only Vehicles (5 entries)

A small number of vehicles (~5) appeared in VP but had **no corresponding TU entry at all**. 
These may be deadheading (traveling without passengers), just starting up, or experiencing 
a prediction system lag. This number was stable and small.

#### The Math

| Source | Count | % of Gap |
|--------|-------|----------|
| Multi-trip vehicle extras | 122 | 57% |
| Trips with no vehicle (future scheduled) | 96 | 45% |
| VP-only vehicles (reduces gap) | -5 | -2% |
| **Total gap** | **213** | **100%** |

**Key finding: TU vehicles NOT in VP = 0.** Every single vehicle ID referenced in a trip 
update was also present in the vehicle positions feed. The feeds are in perfect sync on 
"what buses exist" — they only disagree on "how many trips to show."

### Are Vehicle Positions a Subset of Trip Updates?

**Almost perfectly, yes.** The relationship is:

```
VP vehicles ≈ TU vehicles (with only ~5 VP vehicles missing from TU)
TU trips = VP trips + next-trip predictions + unassigned future trips
```

More precisely:
- **170-171 of 175-176 VP vehicles** had a matching TU entry (97%)
- **0 TU vehicle IDs** were absent from VP (100% coverage in that direction)
- The feeds share the same vehicle ID namespace and trip ID namespace
- VP is a **real-time GPS snapshot** (one entry per physical bus)
- TU is a **prediction engine output** (one entry per trip with predictions, including future trips)

### Is This Real Data or Ghost Data?

**It's real.** Every category represents genuine information:

1. **Multi-trip predictions** = the bus will serve this route next (useful for "next bus" queries)
2. **Unassigned future trips** = scheduled service that will happen (useful for schedule display)
3. The predictions update in real-time — we saw stop counts decrease as buses passed stops

The only potential "ghost" scenario would be if a future trip gets cancelled and its TU entry 
lingers, but we didn't observe this during our sampling window.

### Recommendations for Pullcord

#### 1. Classify Every Trip Update Into Tiers

```typescript
type TripTier = 
  | "active"      // vehicle in VP, trip matches VP trip_id → FULL CONFIDENCE
  | "next-run"    // vehicle in VP, but trip is vehicle's NEXT trip → SHOW AS UPCOMING  
  | "scheduled"   // no vehicle assigned, future start time → SHOW AS SCHEDULE
```

**How to classify:**
- Fetch both feeds simultaneously
- For each TU entry, check: does `tu.vehicle.id` exist in VP?
  - YES → does VP's `trip_id` match this TU's `trip_id`?
    - YES → **"active"** (bus is currently running this trip)
    - NO → **"next-run"** (bus is currently on a different trip, will serve this one next)
  - NO (or no vehicle ID) → **"scheduled"** (future service, no bus assigned yet)

#### 2. Map View: Only Show "active" Tier as Bus Markers

This completely resolves the "more ETAs than buses" confusion. The map shows physical buses. 
ETAs from all tiers appear in the stop arrival list.

#### 3. Stop Arrival List: Show All Tiers With Visual Distinction

| Tier | Visual Treatment | Example |
|------|-----------------|---------|
| active | 🚌 Solid bus icon + "3 min" | Bus 4612 arriving in 3 min |
| next-run | 🔜 Clock icon + "~25 min" | Bus 4612's next run, ~25 min |  
| scheduled | 📅 Calendar icon + "9:55 PM" | Scheduled departure 9:55 PM |

#### 4. Don't Filter — Classify

Filtering out non-active predictions throws away useful rider information. A rider at a 
stop at 9:30 PM wants to know:
- ✅ There's a bus 5 minutes away (active)
- ✅ That same bus will come back in 45 minutes (next-run)  
- ✅ There's also a 10:30 PM departure scheduled (scheduled)

All three are valuable. Just present them honestly.

#### 5. Implementation Notes

- The VP↔TU join is reliable: use `vehicle.id` as the join key (not trip_id)
- Multi-trip detection: group TU entries by vehicle ID; if count > 1, the one matching 
  VP's trip_id is current, the rest are next-runs
- Feed staleness: VP and TU timestamps are within ~30 seconds of each other — safe to 
  fetch and join in a single request cycle
- The ~5 VP-only vehicles can be shown on the map without ETA predictions (just position dot)
