---
name: Theme constants
description: SummitReady theme values and known pre-existing TS error.
---

## Key values (from artifacts/summit-ready/constants/theme.ts)

- `T.bg` = `#060D1B`
- `T.bgGrad` = `["#060D1B", "#0A1628", "#060E1C"]`
- `T.green` = `#3ECF75`
- `T.blue` = `#4A9FF5`
- `T.orange` = `#FF9030`
- `T.surface` = `#142236`
- `T.border` = `rgba(255,255,255,0.07)`
- `T.textMuted` = `#7A9BB5`
- `T.textDim` = `#4A6580`
- `T.greenDim` = `rgba(62,207,117,0.12)`

## Pre-existing TS error — always ignore

`hooks/useColors.ts:21 TS2352` — harmless type assertion mismatch in the colors hook. Do NOT try to fix it; it's by design and will waste time.
