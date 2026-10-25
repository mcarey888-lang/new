/**
 * Read-only development audit. Never imports sources or changes catalogue rows.
 * Run from api-server: pnpm exec tsx scripts/audit-expedition-route-coverage.ts
 * Engine reads use its dedicated bounded read-only connection exclusively.
 * External-source notes are a dated research snapshot, not refreshed by this script.
 */
import { executeEngineReadOnlyQuery, getEngineReadOnlyPool, pool } from "@workspace/db";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const html = (value: unknown) => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

async function main() {
  const timestamp = new Date().toISOString();
  const client = await pool.connect();
  let stages: any[], expeditions: any[];
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expeditions = (await client.query(
      "SELECT challenge_id, challenge_name, status FROM public.signature_challenges ORDER BY challenge_id")).rows;
    stages = (await client.query(`SELECT s.challenge_id, c.challenge_name, c.status,
      s.stage_order, s.route_key, s.route_name, s.region, s.distance_km, s.ascent_m,
      s.estimated_hours, s.catalogue_mountain
      FROM public.challenge_stages s JOIN public.signature_challenges c USING(challenge_id)
      ORDER BY s.challenge_id,s.stage_order`)).rows;
    await client.query("ROLLBACK");
  } finally { client.release(); }

  // Never switch to the application database if these engine reads fail.
  const routes = await executeEngineReadOnlyQuery(`SELECT ri.id,ri.mountain_id,
    ri.canonical_name,ri.aliases,ri.status::text,m.name mountain_name,m.country
    FROM public.route_identities ri LEFT JOIN public.mountains m ON m.id=ri.mountain_id`);
  const inventory = await executeEngineReadOnlyQuery(`SELECT 'mountains' kind,status::text,count(*)::int count
    FROM public.mountains GROUP BY status
    UNION ALL SELECT 'route_identities',status::text,count(*)::int FROM public.route_identities GROUP BY status
    UNION ALL SELECT 'route_definitions',status::text,count(*)::int FROM public.route_definitions GROUP BY status
    UNION ALL SELECT 'route_facts',status::text,count(*)::int FROM public.route_facts GROUP BY status
    UNION ALL SELECT 'route_geometries',null,count(*)::int FROM public.route_geometries
    UNION ALL SELECT 'geometry_members',null,count(*)::int FROM public.route_geometry_members
    UNION ALL SELECT 'evidence',rights_classification::text,count(*)::int
      FROM public.evidence_sources GROUP BY rights_classification`);
  const requiredTables = ["routes", "route_validation", "route_definition_evidence"];
  const available = await executeEngineReadOnlyQuery(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
    [requiredTables]);
  const missingReadBoundaryTables = requiredTables.filter(name => !available.some(row => row.table_name === name));

  const grouped = new Map<string, any>();
  for (const stage of stages) {
    const key = `${normalize(stage.route_name)}|${normalize(stage.region ?? "")}`;
    if (!grouped.has(key)) grouped.set(key, {
      routeName: stage.route_name, region: stage.region, routeKeys: new Set<string>(),
      expeditions: new Set<string>(), stages: [], linkedStages: 0,
    });
    const row = grouped.get(key);
    row.routeKeys.add(stage.route_key); row.expeditions.add(stage.challenge_id); row.stages.push(stage);
    if (stage.catalogue_mountain) row.linkedStages++;
  }
  const priorities = [...grouped.values()].map(row => {
    const matches = routes.filter(route => [route.canonical_name, ...(Array.isArray(route.aliases) ? route.aliases : [])]
      .some(name => typeof name === "string" && normalize(name) === normalize(row.routeName)));
    const keys = [...row.routeKeys] as string[];
    const source = keys.includes("watkin")
      ? { url: "https://eryri.gov.wales/walk/watkin-path/", status: "Official route page identified; detailed fetch unavailable; geometry and commercial reuse permission unconfirmed." }
      : keys.includes("cmd")
        ? { url: "https://www.walkhighlands.co.uk/fortwilliam/carnmordeargarete.shtml", status: "Reference candidate only. Download terms surfaced as personal-use; do not import commercially without permission." }
        : { url: "https://download.geofabrik.de/europe/great-britain.html", status: "OSM source available under ODbL; specific named relation and exact route variant not yet assessed." };
    return {
      routeName: row.routeName, region: row.region, routeKeys: keys,
      stageUses: row.stages.length, expeditionIds: [...row.expeditions].sort(),
      catalogueLinkedStages: row.linkedStages,
      currentDistancesKm: [...new Set(row.stages.map((s: any) => Number(s.distance_km)))],
      currentAscentsM: [...new Set(row.stages.map((s: any) => Number(s.ascent_m)))],
      exactNameCandidates: matches.map(r => ({ id: r.id, name: r.canonical_name, mountain: r.mountain_name,
        country: r.country, status: r.status })),
      // A name match is never automatically a canonical route link or geometry authorization.
      action: matches.length ? "Review route identity, variant, facts, rights and geometry" : "Source a named route and exact variant",
      technicalReview: /ridge|edge|arête|arete|crib goch|aonach|liathach|teallach/i.test(row.routeName)
        ? "Scrambling/exposure review needed; ordinary foot-routing output is not an approved substitute."
        : "Check start/finish, direction, full-route distance, ascent, access and source date.",
      source,
    };
  }).sort((a, b) => b.stageUses - a.stageUses || a.routeName.localeCompare(b.routeName));
  const report = { timestamp, environment: "development only",
    scope: "Application expedition metadata and the dedicated engine catalogue; no production check, no data mutations.",
    summary: { expeditions: expeditions.length, stages: stages.length, distinctRoutes: priorities.length,
      catalogueLinkedStages: stages.filter(s => s.catalogue_mountain).length,
      exactRouteNameCandidateGroups: priorities.filter(p => p.exactNameCandidates.length).length,
      stageUsesCoveredByTopTen: priorities.slice(0, 10).reduce((n, r) => n + r.stageUses, 0) },
    engineInventory: inventory, missingReadBoundaryTables,
    sourceResearch: { date: "2026-10-25",
      watkinOsmPilot: "Small bounded Overpass tags-only query attempted with POST and GET; both returned HTTP 406. No relation inventory obtained; do not infer that Watkin is absent from OSM.",
      geofabrik: "Great Britain OSM download page and ODbL availability checked; approximately 2 GB extract deliberately not downloaded.",
      walkhighlands: "Search surfaced a personal-use download restriction; commercial permission has not been obtained.",
      eryri: "Official Watkin Path URL identified in search; detailed page fetch unavailable." },
    caveats: [
      "Current stage km/ascent are existing owner-curated figures, not independently verified by this audit.",
      "Route-name matching is normalized exact-name/declared-alias screening, not fuzzy or geometry matching.",
      "No source files, GPX tracks or map geometry have been imported or approved.",
      "Engine route geometry is not disclosed. Missing version-bound validation or exact reusable rights must remain a hard gate.",
      "Availability of a GPX download does not establish commercial reuse rights.",
      "The large OSM extract was not downloaded; route-specific OSM coverage remains unassessed.",
      "The Watkin tags-only Overpass pilot was blocked by HTTP 406, not a no-match result.",
      "Coverage is the canonical engine route layer, not private saved routes, GPS recordings, AI caches or paths visible on a basemap.",
      "Mountain lifecycle counts are not canonical trust counts: imported DoBIH records can qualify via trusted-source evidence.",
    ], priorities, stages };
  const out = fileURLToPath(new URL(`../../../generated-artifacts/route-coverage/${timestamp.slice(0, 10)}/`, import.meta.url));
  await mkdir(out, { recursive: true });
  await writeFile(`${out}audit.json`, JSON.stringify(report, null, 2));
  const fields = ["Priority", "Route", "Region", "Stage uses", "Expedition IDs", "Existing km (unverified)",
    "Existing ascent m (unverified)", "Exact route name candidates", "Action", "Source candidate", "Rights/coverage status"];
  await writeFile(`${out}route-priorities.csv`, [fields.map(csv).join(","), ...priorities.map((r, i) =>
    [i + 1, r.routeName, r.region, r.stageUses, r.expeditionIds.join("; "), r.currentDistancesKm.join("; "),
      r.currentAscentsM.join("; "), r.exactNameCandidates.length, r.action, r.source.url, r.source.status].map(csv).join(","))].join("\n"));
  await writeFile(`${out}audit.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>SummitReady expedition route coverage audit</title><style>
    body{font:16px/1.6 system-ui,sans-serif;background:#081411;color:#e6f2ee;margin:0;padding:32px;max-width:1300px}
    h1,h2{line-height:1.2}h2{margin-top:40px}a{color:#74e3b6}small,.muted{color:#acbdb5}
    .stats{display:flex;gap:24px;flex-wrap:wrap}.stat{padding:16px 24px;background:#142a23;border-radius:8px}
    .stat b{display:block;font-size:32px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}
    th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #29473b}th{color:#74e3b6}
    .note{padding:18px;background:#2b2616;border-left:4px solid #e6bc57}li{margin-bottom:8px}
    </style><h1>Expedition route coverage audit</h1><p class="muted">${html(timestamp)} · Development only · Read-only data inspection</p>
    <div class="stats">${Object.entries({ Expeditions: report.summary.expeditions, Stages: stages.length,
      "Distinct routes": priorities.length, "Summit-linked stages": report.summary.catalogueLinkedStages })
      .map(([label, value]) => `<div class="stat"><b>${value}</b>${html(label)}</div>`).join("")}</div>
    <p class="note">No existing expeditions, artwork, progress, route facts or database settings were changed.
    This report is an acquisition/review queue—not a verified hiking or navigation guide.</p>
    <h2>What already exists</h2><div class="scroll"><table><tr><th>Catalogue</th><th>Status</th><th>Records</th></tr>
    ${inventory.map(r => `<tr><td>${html(r.kind)}</td><td>${html(r.status ?? "—")}</td><td>${html(r.count)}</td></tr>`).join("")}</table></div>
    <p>Exact normalized stage-route name/declared-alias candidate groups: ${report.summary.exactRouteNameCandidateGroups}.
    The ten most-used route groups cover ${report.summary.stageUsesCoveredByTopTen} of ${stages.length} stage placements.
    Covering both stages of a particular expedition must still be checked separately.</p>
    <h2>Route-data connection readiness</h2><p>Expected canonical read-boundary tables absent from this connected catalogue:
    ${html(missingReadBoundaryTables.join(", ") || "none")}. Their absence does not mean the summit catalogue is missing.
    Confirm engine schema compatibility before enabling canonical route reads; do not add a fallback database.</p>
    <h2>Acquisition priorities</h2><div class="scroll"><table><tr><th>#</th><th>Route / region</th><th>Uses</th>
    <th>Existing figures—not verified</th><th>Expeditions</th><th>Source / review status</th></tr>
    ${priorities.map((r, i) => `<tr><td>${i + 1}</td><td><b>${html(r.routeName)}</b><br>${html(r.region)}</td>
    <td>${r.stageUses}</td><td>${html(r.currentDistancesKm.join(" / "))} km<br>${html(r.currentAscentsM.join(" / "))} m ascent</td>
    <td>${html(r.expeditionIds.join(", "))}</td><td><a href="${html(r.source.url)}">Source candidate</a><br>${html(r.source.status)}
    <br><small>${html(r.technicalReview)}</small></td></tr>`).join("")}</table></div>
    <h2>Source pilot</h2><p>External source research snapshot: ${report.sourceResearch.date}.
    ${html(report.sourceResearch.watkinOsmPilot)} ${html(report.sourceResearch.geofabrik)}</p>
    <h2>Recommended next steps</h2><ol><li>Inspect named OSM walking/hiking relations for the highest-use routes using small regional extracts,
    recording source IDs, versions and ODbL obligations. Do not download the whole country for an initial pilot.</li>
    <li>Review exact route variants and their real start/finish. For missing or unsuitable data, obtain permission from official route owners or guides.</li>
    <li>Stage licensed candidates separately. Validate topology and exact geometry-version evidence before approving or linking existing expedition stages.</li>
    <li>Preserve existing expedition IDs, artwork and user snapshots. Never replace route ascent with summit height.</li></ol>
    <h2>Limits</h2><ul>${report.caveats.map(c => `<li>${html(c)}</li>`).join("")}</ul>
    <h2>Source references</h2><ul><li><a href="https://www.openstreetmap.org/copyright">OpenStreetMap licence and attribution</a></li>
    <li><a href="https://download.geofabrik.de/europe/great-britain.html">Geofabrik Great Britain extracts (ODbL)</a></li>
    <li><a href="https://www.walkhighlands.co.uk/download-ge.php?w=772">Walkhighlands download terms—personal-use restriction surfaced in search; permission required</a></li>
    <li><a href="https://eryri.gov.wales/walk/watkin-path/">Eryri Watkin Path—official candidate page; detailed fetch unavailable</a></li></ul></html>`);
  console.log(JSON.stringify({ output: out, summary: report.summary, missingReadBoundaryTables }, null, 2));
}
main().catch(() => { console.error("Audit failed. No database writes were attempted; no successful report claimed."); process.exitCode = 1; })
  .finally(async () => { await getEngineReadOnlyPool()?.end(); await pool.end(); });
