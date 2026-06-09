# SummitReady — Mountain Lookup System Evaluation Report

**Date:** 9 June 2026  
**Mountains tested:** 20 primary + 5 bonus  
**Code changes made:** None — read-only testing exercise  
**Purpose:** Evaluate data quality before Priority 1 (user-powered verification system)

---

## Section 1 — Full Results Table (20 Primary Mountains)

| # | Mountain | Found | Summit ID | Summit (AI) | Summit (Actual) | Routes | Route Quality | Elev Gain | Distance | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Snowdon | ✅ | ✅ Correct | 1085m | 1085m | 4 | High | ✅ Plausible | ✅ Plausible | **9/10** |
| 2 | Ben Nevis | ✅ | ✅ Correct | 1345m | 1345m | 3 | High | ✅ Plausible | ✅ Plausible | **8/10** |
| 3 | Scafell Pike | ✅ | ✅ Correct | 978m | 978m | 4 | High | ✅ Plausible | ✅ Plausible | **9/10** |
| 4 | Mont Blanc | ✅ | ✅ Correct | 4810m | 4808m | 4 | High | ⚠️ Questionable | ✅ Plausible | **6/10** |
| 5 | Tryfan | ✅ | ✅ Correct | 917m | 918m | 3 | High | ✅ Plausible | ✅ Plausible | **8/10** |
| 6 | Pen y Fan | ✅ | ✅ Correct | 886m | 886m | 4 | High | ✅ Plausible | ✅ Plausible | **9/10** |
| 7 | Helvellyn | ✅ | ✅ Correct | 950m | 950m | 4 | Medium | ⚠️ Questionable | ✅ Plausible | **7/10** |
| 8 | Yr Wyddfa | ✅ | ✅ Correct | 1085m | 1085m | 4 | High | ✅ Plausible | ✅ Plausible | **7/10** |
| 9 | Musbury Tor | ✅ | ⚠️ Partial | 338m | ~363m | 2 | Low | ✅ Plausible | ✅ Plausible | **4/10** |
| 10 | Thieveley Pike | ✅ | ✅ Correct | 449m | ~450m | 3 | Medium | ✅ Plausible | ✅ Plausible | **7/10** |
| 11 | Hail Storm Hill | ✅ | ✅ Correct | 477m | 477m | 3 | Medium | ✅ Plausible | ✅ Plausible | **7/10** |
| 12 | Peel Tower (Holcombe Hill) | ✅ | ⚠️ Partial | 345m | ~373m | 3 | Medium | ✅ Plausible | ✅ Plausible | **7/10** |
| 13 | Matterhorn | ✅ | ✅ Correct | 4478m | 4478m | 3 | High | ⚠️ Questionable | ✅ Plausible | **6/10** |
| 14 | Lagginhorn | ✅ | ✅ Correct | 4010m | 4010m | 3 | Medium | ⚠️ Questionable | ✅ Plausible | **5/10** |
| 15 | Toubkal | ✅ | ✅ Correct | 4167m | 4167m | 3 | High | ⚠️ Questionable | ✅ Plausible | **7/10** |
| 16 | Gerlachovský štít | ✅ | ✅ Correct | 2655m | 2655m | 3 | Medium | ⚠️ Questionable | ✅ Plausible | **6/10** |
| 17 | Pico Ruivo | ✅ | ✅ Correct | 1862m | 1862m | 3 | High | ✅ Plausible | ✅ Plausible | **8/10** |
| 18 | Cima Dodici | ✅ | ✅ Correct | 2336m | 2336m | 3 | Medium | ✅ Plausible | ⚠️ Questionable | **7/10** |
| 19 | Vihren | ✅ | ✅ Correct | 2914m | 2914m | 4 | High | ✅ Plausible | ✅ Plausible | **8/10** |
| 20 | Sgùrr na Banachdaich | ✅ | ✅ Correct | 965m | 965m | 3 | Medium | ✅ Plausible | ✅ Plausible | **7/10** |

---

## Section 2 — Raw Route Data

### Group 1 — Famous Mountains

**1. Snowdon** (Wales, Snowdonia)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Pyg Track | 11km | 726m | 1085m | Moderate | Pen-y-Pass (~359m) |
| Llanberis Path | 14.5km | 970m | 1085m | Moderate | Llanberis (~115m) |
| Watkin Path | 13km | 983m | 1085m | Hard | Nantgwynant (~102m) |
| Rhyd Ddu Path | 12km | 887m | 1085m | Moderate | Rhyd Ddu (~198m) |

**2. Ben Nevis** (Scotland)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Mountain Track (Tourist Route) | 17km | 1352m | 1345m | Moderate | Achintee, Glen Nevis |
| Carn Mor Dearg Arete | 15km | 1500m | 1345m | Hard | North Face car park, Torlundy |
| North Face Climbers' Route | 12km | 1300m | 1345m | Alpine | North Face car park, Torlundy |

**3. Scafell Pike** (England, Lake District)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Wasdale Head Route | 11km | 910m | 978m | Moderate | Wasdale Head car park (~68m) |
| Seathwaite Route | 16km | 870m | 978m | Hard | Seathwaite (~108m) |
| Eskdale Route | 14km | 890m | 978m | Hard | Eskdale (~88m) |
| Langdale Route | 17km | 910m | 978m | Hard | Old Dungeon Ghyll car park (~68m) |

**4. Mont Blanc** (France/Italy, Alps)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Goûter Route | 20km | 3800m | 4810m | Hard | Saint-Gervais-les-Bains, Nid d'Aigle |
| Three Monts Traverse | 22km | 3950m | 4810m | Alpine | Chamonix, Aiguille du Midi cable car ⚠️ |
| Italian (Pope) Route | 25km | 4100m | 4810m | Alpine | Courmayeur, Rifugio Gonella |
| Grand Mulets Route | 28km | 3900m | 4810m | Alpine | Chamonix, Glacier des Bossons |

> ⚠️ Three Monts Traverse: Aiguille du Midi cable car station is at ~3,842m, yet gain is listed as 3,950m — these figures are mutually contradictory.

---

### Group 2 — Multi-Route Mountains

**5. Tryfan** (Wales, Snowdonia)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| North Ridge | 5.6km | 659m | 917m | Hard | A5 roadside near Llyn Ogwen (~258m) |
| South Ridge | 6.5km | 659m | 917m | Moderate | A5 roadside near Llyn Ogwen (~258m) |
| Heather Terrace | 5.8km | 659m | 917m | Moderate | A5 roadside near Llyn Ogwen (~258m) |

**6. Pen y Fan** (Wales, Brecon Beacons)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Storey Arms Route | 6.4km | 440m | 886m | Moderate | Storey Arms (446m) |
| Pont ar Daf Route | 5.6km | 390m | 886m | Easy | Pont ar Daf car park (496m) |
| Cwm Llwch Route | 10.5km | 620m | 886m | Moderate | Cwm Gwdi car park (266m) |
| Horseshoe Ridge Walk | 15km | 725m | 886m | Hard | Pont Cwm Sere (161m) |

**7. Helvellyn** (England, Lake District)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Striding Edge and Swirral Edge | 12km | 905m | 950m | Hard | Glenridding |
| The Thirlmere Route | 11km | 870m | 950m | Moderate | Swirls car park ⚠️ |
| The Glenridding Common Route | 12km | 890m | 950m | Moderate | Glenridding |
| The Patterdale Route | 13km | 910m | 950m | Moderate | Patterdale |

> ⚠️ Thirlmere Route: Swirls car park is at ~310–350m. Net gain to summit = ~600–640m. Reported gain of 870m appears too high.

**8. Yr Wyddfa** (Wales, Snowdonia) — *same mountain as Snowdon*
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Pyg Track | 11km | 726m | 1085m | Moderate | Pen-y-Pass (359m) |
| Llanberis Path | 14.5km | 970m | 1085m | Moderate | Llanberis (115m) |
| Watkin Path | 13km | 983m | 1085m | Hard | Nantgwynant (102m) |
| Rhyd Ddu Path | 12km | 873m | 1085m | Moderate | Rhyd Ddu (212m) ⚠️ |

> ⚠️ Minor inconsistency vs Snowdon lookup: Rhyd Ddu gain 873m here vs 887m for Snowdon; start elevation 212m vs 198m. Stored as separate cache entries.

---

### Group 3 — Local / Obscure UK Hills

**9. Musbury Tor** (England, Lancashire)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Helmshore Circular Route | 6km | 150m | 338m ⚠️ | Moderate | Helmshore |
| Musbury Valley Direct Ascent | 4km | 190m | 338m ⚠️ | Moderate | Musbury Valley Car Park |

> ⚠️ Summit 338m vs actual ~363m. Only 2 routes returned — lowest count in dataset.

**10. Thieveley Pike** (England, Lancashire)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Cliviger Gorge Circular | 9km | 310m | 449m | Moderate | Holme Chapel, near Burnley |
| Rake Head and Thieveley Pike | 6.5km | 255m | 449m | Moderate | Rake Head, near Holme Chapel |
| Thieveley Pike Direct from Holme Chapel | 5km | 280m | 449m | Moderate | Holme Chapel, near Burnley |

**11. Hail Storm Hill** (England, Lancashire)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Rooley Moor Road Route | 10km | 275m | 477m | Easy | Rooley Moor Road, near Whitworth |
| Cowpe Lowe Circular | 8km | 320m | 477m | Moderate | Cowpe Village, near Waterfoot |
| Edenfield to Hail Storm Hill Trail | 12km | 410m | 477m | Moderate | Edenfield, south of the hill |

**12. Peel Tower, Holcombe Hill** (England, Greater Manchester/Lancashire)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Lumb Carr Road Route | 4km | 160m | 345m ⚠️ | Easy | Lumb Carr Road car park (~185m) |
| Holcombe Village Circular | 6km | 200m | 345m ⚠️ | Moderate | Holcombe Village (~145m) |
| Rambottom to Peel Tower Trail | 8km | 225m | 345m ⚠️ | Moderate | Ramsbottom railway station (~120m) |

> ⚠️ Summit 345m vs actual ~373m. "Rambottom" misspelled (should be "Ramsbottom").

---

### Group 4 — European Mountains

**13. Matterhorn** (Switzerland, Pennine Alps)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Hörnli Ridge | 12km | 1213m | 4478m | Alpine | Hörnli Hut (3265m ✅) |
| Lion Ridge | 10km | 1203m | 4478m | Alpine | Carrel Hut (3275m ⚠️ actual ~3829m) |
| Zmutt Ridge | 14km | 1213m | 4478m | Alpine | Schönbiel Hut (3265m ⚠️ actual ~2694m) |

**14. Lagginhorn** (Switzerland, Pennine Alps)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Normal Route (West Ridge) | 8km | 1309m | 4010m | Alpine | Hohsaas (2701m ⚠️ actual ~3099m) |
| South Ridge | 10km | 1509m | 4010m | Alpine | Weissmieshütte (2501m ⚠️ actual ~2726m) |
| South-East Flank | 11km | 1609m | 4010m | Alpine | Saas Grund (2401m ⚠️ actual ~1559m) |

**15. Toubkal** (Morocco, High Atlas)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Standard Route (South Cwm) | 19km | 2117m | 4167m | Moderate | Imlil (~2050m ⚠️ actual ~1740m) |
| North Col Route | 17km | 2030m | 4167m | Hard | Imlil (~2137m ⚠️ actual ~1740m) |
| Ikhibi Sud Route | 22km | 2102m | 4167m | Hard | Imlil (~2065m ⚠️ actual ~1740m) |

**16. Gerlachovský štít** (Slovakia, High Tatras)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Velická Próba | 16km | 1286m | 2655m | Alpine | Sliezsky Dom (1670m ✅) |
| Batizovská próba | 12km | 985m | 2655m | Alpine | Batizovské Pleso (1670m) |
| Krošnie Route | 18km | 1400m | 2655m | Alpine | Tatranská Polianka (1255m) ⚠️ name unverifiable |

---

### Group 5 — Challenging / Obscure Tests

**17. Pico Ruivo** (Portugal, Madeira)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Achada do Teixeira Route | 5.6km | 300m | 1862m | Easy | Achada do Teixeira (~1562m) |
| Pico do Arieiro to Pico Ruivo (PR1) | 12.4km | 1200m | 1862m | Hard | Pico do Arieiro (~1616m) ✅ |
| Encumeada to Pico Ruivo Route | 15.4km | 1400m | 1862m | Hard | Encumeada (~462m) |

> ✅ The Arieiro route correctly shows 1,200m accumulated gain despite only ~246m net elevation difference — the system correctly accounted for undulating traverse terrain.

**18. Cima Dodici** (Italy, Trentino)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| From Borgo Valsugana (via Malga Valsugana) | 24km | 1655m | 2336m | Hard | Borgo Valsugana (~681m) |
| From Malga Larici | 14km | 950m | 2336m | Moderate | Malga Larici (~1386m) |
| From Val Galmarara | 16km | 1135m | 2336m | Moderate | Val Galmarara (~1201m) |

**19. Vihren** (Bulgaria, Pirin Mountains)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Banderitsa Hut Route | 8km | 1000m | 2914m | Moderate | Banderitsa Hut (1914m ⚠️ actual ~1810m) |
| Vihren Hut Route | 7.4km | 960m | 2914m | Moderate | Vihren Hut (1954m ✅) |
| Kazani Route via Vihren Hut | 11km | 980m | 2914m | Hard | Vihren Hut (1954m) |
| Koncheto Ridge from Vihren Hut | 14km | 960m | 2914m | Alpine | Vihren Hut (1954m) |

**20. Sgùrr na Banachdaich** (Scotland, Isle of Skye)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Coire nan Eich Route | 8km | 1010m | 965m | Hard | Glen Brittle Memorial Hut (~55m) |
| South West Ridge Route | 7km | 910m | 965m | Hard | Glen Brittle Campsite (~55m) |
| An Dorus Approach | 8.5km | 920m | 965m | Alpine | Glen Brittle Memorial Hut (~55m) |

---

## Section 3 — Overall Statistics

| Metric | Result |
|---|---|
| Mountains found | **20 / 20 (100%)** |
| Summit identification — Correct | **18 / 20 (90%)** |
| Summit identification — Partially Correct | **2 / 20 (10%)** |
| Summit identification — Incorrect | **0 / 20 (0%)** |
| Route quality — High | **11 / 20** |
| Route quality — Medium | **8 / 20** |
| Route quality — Low | **1 / 20** |
| Elevation gain — Plausible | **14 / 20 (70%)** |
| Elevation gain — Questionable | **6 / 20 (30%)** |
| Elevation gain — Clearly Incorrect | **0 / 20 (0%)** |
| Distance — Plausible | **19 / 20 (95%)** |
| Distance — Questionable | **1 / 20 (5%)** |
| Average confidence score | **7.1 / 10** |

---

## Section 4 — Performance by Group

| Group | Mountains | Avg Confidence | Gain Plausible | Gain Questionable |
|---|---|---|---|---|
| 1 — Famous Mountains | Snowdon, Ben Nevis, Scafell Pike, Mont Blanc | 8.0/10 | 3/4 | 1/4 |
| 2 — Multi-Route Mountains | Tryfan, Pen y Fan, Helvellyn, Yr Wyddfa | 7.8/10 | 3/4 | 1/4 |
| 3 — Local/Obscure UK Hills | Musbury Tor, Thieveley Pike, Hail Storm Hill, Peel Tower | 6.3/10 | 4/4 | 0/4 |
| 4 — European Mountains | Matterhorn, Lagginhorn, Toubkal, Gerlachovský štít | 6.0/10 | 0/4 | 4/4 |
| 5 — Challenging/International | Pico Ruivo, Cima Dodici, Vihren, Sgùrr na Banachdaich | 7.5/10 | 4/4 | 0/4 |

### Group notes

**Group 1 (Famous Mountains) — Best performing group**  
All 4 summits exact. All route names genuine. The only issue is Mont Blanc's Three Monts Traverse: lists Aiguille du Midi as start (~3,842m actual) but quotes gain of 3,950m — these figures are contradictory. All other routes for Mont Blanc are plausible.

**Group 2 (Multi-Route Mountains) — Second best**  
Strong performance. Notable: Yr Wyddfa and Snowdon are the same mountain, stored as separate cache entries with slightly inconsistent data (Rhyd Ddu gain: 873m vs 887m; start elevation: 212m vs 198m). Helvellyn's Thirlmere Route gain (870m) is too high — Swirls car park at ~320–350m gives a net gain of only ~600–640m to the 950m summit.

**Group 3 (Local/Obscure UK Hills) — Weakest UK group**  
All 4 hills found. Summit accuracy drops slightly for the most obscure entries (Musbury Tor −25m, Peel Tower −28m). Interestingly, elevation gains remain plausible because the hills are small enough that errors don't compound. Route names trend toward generic descriptions rather than formally named trails. Musbury Tor returned only 2 routes — a signal of low AI confidence.

**Group 4 (European Mountains) — Weakest overall group**  
All 4 summits exact. However, ALL 4 had questionable elevation gains due to incorrect trailhead/hut elevations:

| Mountain | Location | AI Elevation | Actual Elevation | Error |
|---|---|---|---|---|
| Matterhorn | Carrel/Lion Hut | 3,275m | ~3,829m | −554m |
| Matterhorn | Schönbiel Hut | 3,265m | ~2,694m | +571m |
| Lagginhorn | Saas Grund | 2,401m | ~1,559m | +842m |
| Lagginhorn | Weissmieshütte | 2,501m | ~2,726m | −225m |
| Toubkal | Imlil | ~2,090m avg | ~1,740m | +350m |

Since gain = summit − trailhead, wrong trailhead elevations directly corrupt the gain figure. The AI knows hut/village *names* but not their precise elevations.

**Group 5 (Challenging/International) — Better than expected**  
Pico Ruivo's Arieiro-to-Ruivo traverse correctly shows 1,200m accumulated gain despite only ~246m net elevation difference — the AI correctly recognised the undulating nature of the PR1 trail. Vihren and Sgùrr na Banachdaich both reliable. Cima Dodici's 24km from Borgo Valsugana seems long for a Dolomite approach.

---

## Section 5 — Bonus Test Results

| Mountain | Summit (AI) | Routes | Route Quality | Confidence | Notes |
|---|---|---|---|---|---|
| Kinder Scout | 636m ✅ | 4 | High | **8/10** | All 4 routes genuine (Jacob's Ladder, Grindsbrook Clough, Hayfield, Snake Pass). Gains internally consistent. |
| The Old Man of Coniston | 803m ✅ | 3 | High | **8/10** | Walna Scar Road, Coniston Village, Low Water Circular all genuine. Gains match summit − start. |
| Puy de Dôme | 1465m ✅ | 3 | Medium | **7/10** | Chemin des Muletiers ✅ genuine. "Panoramique des Dômes" returned gain of **0m** — this is the rack railway, not a walking route. |
| Schiehallion | 1083m ✅ | 3 | High | **8/10** | Braes of Foss is the canonical route ✅. West Ridge and East Ridge plausible. Gains consistent. |
| Indians Head (Dovestones) | 391m | 3 | Medium | **6/10** | Name correctly resolved to "Indian's Head (Dovestones)". All 3 routes start from Dovestones car park — correct base. Summit figure plausible for the rock feature. |

### Bonus test raw data

**Kinder Scout** (England, Peak District)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Jacob's Ladder via Edale | 12km | 490m | 636m | Moderate | Edale Village |
| Kinder Scout via Grindsbrook Clough | 9km | 520m | 636m | Moderate | Edale Village |
| Circular via Hayfield and Kinder Reservoir | 14km | 390m | 636m | Moderate | Hayfield Village |
| Via Snake Pass and Fairbrook Naze | 11km | 420m | 636m | Moderate | Snake Pass (A57) |

**The Old Man of Coniston** (England, Lake District)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Walna Scar Road Route | 10km | 620m | 803m | Moderate | Walna Scar Road car park (~183m) |
| Coniston Village Route | 11.5km | 690m | 803m | Moderate | Coniston Village (~113m) |
| Low Water Circular Route | 8km | 620m | 803m | Moderate | Walna Scar Road car park (~183m) |

**Puy de Dôme** (France, Auvergne)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Chemin des Muletiers | 7km | 350m | 1465m | Moderate | Col de Ceyssat (~1115m) |
| Sentier des Chèvres | 8km | 400m | 1465m | Moderate | Laschamps (~1065m) |
| Panoramique des Dômes | 10km | 0m ⚠️ | 1465m | Easy | Orcines (~900m) |

> ⚠️ "Panoramique des Dômes" is the rack railway — not a walking route. Gain of 0m correctly reflects this but the route should not appear in a hiking app.

**Schiehallion** (Scotland, Perthshire)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Braes of Foss Path | 10km | 730m | 1083m | Moderate | Braes of Foss car park (~353m) |
| West Ridge Route | 12km | 765m | 1083m | Moderate | Dunalastair Water (~318m) |
| East Ridge Traverse | 14km | 730m | 1083m | Hard | Braes of Foss car park (~353m) |

**Indians Head (Dovestones)** (England, Greater Manchester)
| Route | Distance | Gain | Summit | Difficulty | Start |
|---|---|---|---|---|---|
| Dovestones Reservoir Circular | 8km | 350m | 391m | Moderate | Dovestones Reservoir car park |
| Indian's Head via Chew Reservoir | 10km | 370m | 391m | Moderate | Dovestones Reservoir car park |
| Indian's Head via Ashway Gap | 7km | 330m | 391m | Moderate | Ashway Gap car park |

---

## Section 6 — Pattern Analysis

### Pattern 1: Elevation gain = summit altitude − trailhead altitude
This is the system's dominant gain calculation strategy. It is:
- ✅ **Accurate** for simple out-and-back routes on well-documented UK hills
- ✅ **Internally self-consistent** — numbers add up
- ⚠️ **Wrong** when trailhead elevation is wrong (most common failure mode)
- ⚠️ **Underestimates** real accumulated gain for routes with significant undulation
- ✅ **Handles traverses correctly** in at least one case (Pico Ruivo PR1)

### Pattern 2: Summit altitudes are highly reliable
18/20 summits correct to within ±2m. The two partial misses (Musbury Tor −25m, Peel Tower −28m) are both obscure Lancashire hills with limited online documentation. Every mountain with significant online presence had an exact or near-exact summit.

### Pattern 3: International hut and trailhead elevations are unreliable
For alpine/international routes starting from mountain huts, the AI frequently invents plausible-sounding hut elevations that are wrong. This is the highest-impact failure because it silently corrupts the displayed elevation gain. No error is surfaced to the user.

### Pattern 4: Yr Wyddfa / Snowdon duplicate — no canonical name resolution
Welsh mountains have both Welsh and English names. Searching "Snowdon" and "Yr Wyddfa" produces two separate cache entries (slugs: `snowdon` and `yr-wyddfa-snowdon`) with slightly different route figures for the same physical mountain. As the cache grows, more such duplicates will accumulate.

### Pattern 5: Obscure hill route names trend toward generic descriptors
For famous mountains, route names match well-known trail names (Pyg Track, Striding Edge, Hörnli Ridge). For obscure hills, names become descriptive placeholders ("Musbury Valley Direct Ascent", "Edenfield to Hail Storm Hill Trail") that may not correspond to any formal trail and cannot be independently verified.

### Pattern 6: Route count as a confidence signal
Most mountains return 3–4 routes. Musbury Tor returned only 2 — this correctly reflects the AI's lower confidence on a very obscure hill. This could be used as a programmatic confidence indicator.

### Pattern 7: Railway routes can appear alongside hiking routes
Puy de Dôme's "Panoramique des Dômes" rack railway was returned as a route with 0m elevation gain. The system does not distinguish between walking routes and non-walking access options.

---

## Section 7 — Biggest Risks to Data Quality (Ranked)

### 🔴 Risk #1 — Elevation Gain Calculation (Highest Impact)
The system calculates gain as `summit − trailhead`. Both components can be wrong:
- Trailhead elevations for international/alpine mountains are often significantly incorrect
- The formula ignores accumulated gain from route undulation
- 6 of 20 primary mountains (30%) have questionable gain figures
- All 4 European mountains failed on this metric
- Users planning training loads receive incorrect numbers with no warning

### 🟠 Risk #2 — Alpine/International Trailhead Elevation Accuracy
Specifically for routes starting from mountain huts. The AI reliably knows hut *names* but not their precise elevations. Errors range from 100m (minor) to 842m (Saas Grund). Since gain is derived from start elevation, this error propagates silently.

### 🟡 Risk #3 — No Canonical Mountain Identity / Duplicate Cache Entries
Yr Wyddfa and Snowdon are the same mountain with two cache entries producing slightly different data. Other likely duplicates: Scafell vs Scafell Pike, mountains with Gaelic vs anglicised names, mountains known by multiple regional names. As the cache grows this creates a growing set of inconsistencies.

### 🟡 Risk #4 — Route Name Reliability for Obscure Hills
For well-known mountains, route names are verifiably correct. For obscure UK hills and lesser-documented international mountains, route names are generic descriptors that may not correspond to real trails. Users cannot look these up or verify them externally.

### 🟡 Risk #5 — Non-Hiking Routes Included
Puy de Dôme returned a rack railway as a route. Other popular mountains with cable cars or mountain railways (Snowdon Mountain Railway, Schilthorn, etc.) could similarly return non-hiking access options as "routes."

### 🟢 Risk #6 — Summit Altitude Accuracy (Low Risk)
90% correct, 10% partial, 0% completely wrong. Misses are small (< 30m) and confined to very obscure hills. This is the most reliable data point the system produces.

### 🟢 Risk #7 — Route Distance (Low Risk)
19/20 distances plausible. Distances are hard to verify precisely and users generally have lower precision expectations here.

---

## Section 8 — Readiness Assessment for Priority 1

| Area | Readiness | Recommendation |
|---|---|---|
| Finding any mountain | ✅ Ready | 100% found rate including obscure local hills |
| Summit altitude | ✅ Ready | 90%+ accuracy across all categories |
| UK mountain route names | ✅ Ready | High quality for well-documented hills |
| UK elevation gain | ✅ Ready | Reliable where trailhead elevations are accurate |
| International elevation gain | ⚠️ Needs verification | Trailhead elevation errors common — priority target for user corrections |
| Obscure hill data | ⚠️ Needs verification | Route names may be generic; summit accuracy drops |
| Mountain identity / deduplication | ⚠️ Structural gap | Welsh/English name variants create duplicate entries — Priority 1 should canonicalise by coordinates, not slug |
| Non-hiking route filtering | ⚠️ Minor gap | Rack railways / cable cars can appear as routes |

**The user-powered verification system (Priority 1) would be most impactful if it targets elevation gain corrections first** — this is both the most frequent failure mode (30% of mountains) and the data point users are most likely to notice as wrong when they are actually on the hill.

The second highest-value target for Priority 1 is **international/alpine trailhead elevation corrections**, particularly for mountains with named huts as start points, where AI elevation knowledge is consistently unreliable.

---

*Report generated by automated live API testing — no code was modified. All results are real outputs from the production mountain lookup pipeline as of 9 June 2026.*
