# Replit — questions about the summit data

Paste everything below the line. This asks for information only.

---

**Please do not change any code, schema or data for this. I need answers, not
edits.** If answering means running a read-only query, that is fine; nothing
should be created, altered or migrated.

I am building a map that draws summit pins and clusters them as you zoom, and
I need to know what the data can actually support before writing the query
behind it.

Here is what I can see from the repository, so you know where I am starting:
`canonical_hills` has name, slug, country, region, latitude, longitude,
summit_elevation_m, estimated_gain_m, verified_gain_m, verified_sample_count,
confidence_score and source. `cached_hills` has slug, name, elevation, lat,
lng and some route fields. The migration chain in `lib/db/migrations` creates
neither table.

## 1. Where do the 20,000+ UK summits actually live?

Table name, and which database. I particularly need to know whether it is the
same Postgres instance the api-server already connects to, or a separate one
belonging to the Summit Data Engine. That decides whether the map can query it
directly or needs something in between.

## 2. What are that table's columns?

The full list. I care most about whether any of these exist, under any name:

- **Prominence** — the proper measure of whether a hill is notable. Height is
  a poor stand-in: a 900 m shoulder of a bigger mountain is not a destination,
  and a 600 m isolated hill often is.
- **Classification** — Munro, Corbett, Wainwright, Marilyn, Donald, HuMP, or
  whatever vocabulary the data uses.
- **Ascent or gain**, and whether it is measured or estimated.

## 3. How many rows, and how many have coordinates?

Two numbers. A summit with no latitude and longitude cannot be drawn, so I
need to know how much of the set is actually mappable rather than assuming it
all is.

## 4. What indexes does it have?

Specifically, is there anything on latitude and longitude, or a PostGIS
geometry column with a spatial index?

A map asks "every summit in this rectangle" on every pan. Without an index
that is a full table scan each time. At 20,000 rows that is survivable but
wasteful, and it will not stay survivable.

**Do not add an index yet.** It is a schema change and needs sign-off first. I
just need to know what is there.

## 5. How does it relate to `canonical_hills`?

Is `canonical_hills` a curated subset of the big table, a cache in front of
it, or an unrelated set that happens to overlap? And does a summit in the big
table have a stable id or slug that matches a `canonical_hills` row?

This matters because tapping a pin should open the existing mountain page, and
that only works if the two can be joined.

## 6. One real row, please

Any well-known summit — Yr Wyddfa, Ben Nevis, Scafell Pike. Every column, with
its actual values. A real row settles in ten seconds what column names alone
leave ambiguous: units, how nulls are represented, whether gain is a number or
text.

## Why I am asking rather than guessing

I suggested showing Munros and Wainwrights when the map is zoomed right out,
because that is what someone scanning the country is actually looking for.
Then I checked, and neither table I can see carries a classification — so I
have fallen back to a plain height cutoff, which works but is blunter.

If that data exists somewhere, the map gets noticeably better and it is a
one-function change to use it. If it does not, height stands and I will stop
suggesting otherwise.
