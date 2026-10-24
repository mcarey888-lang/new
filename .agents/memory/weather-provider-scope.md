---
name: Weather provider scope
description: Initial weather budget, forecast horizon and mountain-forecast limits.
---

Use WeatherAPI.com's free commercial plan initially, with a three-day forecast. Keep the presentation able to handle seven days after an explicit future plan upgrade; do not purchase a subscription automatically.

**Why:** On 2026-10-25 the owner chose WeatherAPI over paid Open-Meteo and accepted starting with three days to keep early costs down.

**How to apply:** Check current provider limits before changing the horizon. Forecasts are location forecasts, not verified summit conditions; do not imply elevation adjustment or invent missing gusts, warnings or other measurements. Preserve clear provider attribution and data timestamps.

Regional weather lookup must not depend on eligibility for exact navigation. An unambiguous, non-AI catalogue location can identify a labelled location forecast without authorizing map pins, route starts or directions. Missing or ambiguous weather locations must show an explicit unavailable state rather than silently removing weather.

**Why:** Ben Nevis had a real imported catalogue location but no navigation-verified summit location, so coupling the two hid the forecast entirely.

**How to apply:** Keep weather resolution separate from navigation trust, preserve country and catalogue identity constraints, and never resolve ambiguous names by taking the first search hit.
