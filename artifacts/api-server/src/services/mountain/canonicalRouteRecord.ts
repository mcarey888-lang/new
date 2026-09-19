import { sql } from "drizzle-orm";
import { executeEngineReadOnly } from "@workspace/db";
import type { CanonicalRouteRecord } from "../../../../summit-ready/utils/routeIntelligence";

export type CanonicalRouteRecordStatus =
  | "available"
  | "degraded"
  | "unavailable"
  | "ambiguous";

export type CanonicalRouteRecordResponse = {
  status: CanonicalRouteRecordStatus;
  reasons: string[];
  record: CanonicalRouteRecord | null;
};

type RouteRecordRow = Record<string, unknown> & {
  mountainId?: string;
  mountainName?: string;
  mountainStatus?: string;
  mountainProvenanceVersion?: string;
  routeIdentityKey?: string;
  routeVersion?: string;
  routeName?: string;
  routeAliases?: string[];
  routeStatus?: string;
  definitionVersion?: string;
  definitionKey?: string;
  definitionDescription?: string;
  definitionStatus?: string;
  factVersion?: string;
  factStatus?: string;
  distanceKm?: number | null;
  totalAscentM?: number | null;
  totalDescentM?: number | null;
  startElevationM?: number | null;
  summitElevationM?: number | null;
  typicalDurationHours?: number | null;
  evidenceId?: string;
  publisher?: string;
  evidenceTitle?: string;
  evidenceUrl?: string;
  rightsClassification?: string;
  rightsStatement?: string | null;
  geometryReuseAllowed?: boolean;
  geometry?: { type?: string; coordinates?: unknown } | null;
  geometryVersion?: string | null;
  geometryDerivationMethod?: string | null;
  geometrySourceMembers?: Array<Record<string, unknown>> | null;
  geometryValidationPassed?: boolean;
  profileVersion?: string | null;
  profileSpacingM?: number | null;
  profileCalculationVersion?: string | null;
  profileNodataCount?: number | null;
  profileSourceMembers?: Array<Record<string, unknown>> | null;
  profileSamples?: Array<{ distanceM: number; elevationM: number | null }> | null;
};

export const CANONICAL_ROUTE_RECORD_TABLES = [
  "route_geometries",
  "route_geometry_members",
  "source_bundles",
] as const;

export type CanonicalRouteRecordQuery = (
  identityKey: string,
  version: string,
  mountainId: string,
) => Promise<RouteRecordRow[]>;

const ROUTE_RECORD_SQL = sql`
  SELECT
    m.id::text AS "mountainId",
    m.name AS "mountainName",
    m.status AS "mountainStatus",
    m.provenance_version AS "mountainProvenanceVersion",
    ri.identity_key AS "routeIdentityKey",
    ri.version AS "routeVersion",
    ri.canonical_name AS "routeName",
    ri.aliases AS "routeAliases",
    ri.status AS "routeStatus",
    rd.version AS "definitionVersion",
    rd.id::text AS "definitionKey",
    rd.description AS "definitionDescription",
    rd.status AS "definitionStatus",
    rf.version AS "factVersion",
    rf.status AS "factStatus",
    rf.distance_km AS "distanceKm",
    rf.total_ascent_m AS "totalAscentM",
    rf.total_descent_m AS "totalDescentM",
    rf.start_elevation_m AS "startElevationM",
    rf.summit_elevation_m AS "summitElevationM",
    rf.typical_duration_hours AS "typicalDurationHours",
    e.id::text AS "evidenceId",
    e.publisher AS "publisher",
    e.title AS "evidenceTitle",
    e.url AS "evidenceUrl",
    e.rights_classification AS "rightsClassification",
    e.rights_statement AS "rightsStatement",
    e.geometry_reuse_allowed AS "geometryReuseAllowed",
    CASE WHEN geom.geom IS NULL OR geom.member_count = 0
      OR e.rights_classification <> 'reusable_geometry'
      OR NOT e.geometry_reuse_allowed THEN NULL
      ELSE ST_AsGeoJSON(geom.geom)::jsonb END AS "geometry",
    geom.geometry_version AS "geometryVersion",
    geom.derivation_method AS "geometryDerivationMethod",
    geom.source_members AS "geometrySourceMembers",
    EXISTS (
      SELECT 1 FROM public.route_validation AS rv
      WHERE rv.route_id = rd.route_id AND rv.outcome = 'pass'
    ) AS "geometryValidationPassed",
    NULL::text AS "profileVersion",
    NULL::float8 AS "profileSpacingM",
    NULL::text AS "profileCalculationVersion",
    NULL::int AS "profileNodataCount",
    NULL::json AS "profileSourceMembers",
    NULL::json AS "profileSamples"
  FROM public.route_identities AS ri
  JOIN public.mountains AS m ON m.id = ri.mountain_id
  JOIN public.route_definitions AS rd
    ON rd.route_identity_id = ri.id AND rd.version = ri.version
  JOIN public.route_facts AS rf
    ON rf.route_definition_id = rd.id AND rf.version = rd.version
  JOIN public.evidence_sources AS e ON e.id = rf.evidence_source_id
    LEFT JOIN LATERAL (
      SELECT
        g.geom,
         g.version AS geometry_version,
        g.derivation_method,
        COUNT(es.id)::int AS member_count,
        COALESCE(json_agg(json_build_object(
          'provider', sb.provider,
          'sourceUrl', sb.source_url,
          'licence', sb.licence,
          'sourceHash', sb.sha256,
          'retrievedAt', sb.retrieved_at,
          'provenanceVersion', sb.provenance_version,
          'rightsClassification', es.rights_classification,
          'qaFlags', '[]'::json
        ) ORDER BY gm.id) FILTER (WHERE es.id IS NOT NULL), '[]'::json) AS source_members
      FROM public.route_geometries AS g
      LEFT JOIN public.route_geometry_members AS gm ON gm.route_geometry_id = g.id
      LEFT JOIN public.source_bundles AS sb ON sb.id = gm.source_bundle_id
      LEFT JOIN public.evidence_sources AS es
        ON es.publisher = sb.provider AND es.url = sb.source_url
       AND es.rights_classification = 'reusable_geometry'
       AND es.geometry_reuse_allowed = TRUE
      WHERE g.route_definition_id = rd.id
        AND g.version = rd.version
        AND EXISTS (
          SELECT 1 FROM public.route_validation AS rv
          WHERE rv.route_id = rd.route_id AND rv.outcome = 'pass'
        )
      GROUP BY g.id, g.geom, g.version, g.derivation_method
      ORDER BY g.id DESC
      LIMIT 1
    ) AS geom ON TRUE
`;

function stableRouteId(identityKey: string, version: string): string {
  return `sde:route:${identityKey}@${version}`;
}

function stableMountainId(mountainId: string): string {
  return `sde:mountain:${mountainId}`;
}

function reasonList(row: RouteRecordRow): string[] {
  const reasons: string[] = [];
  if (!row.geometry) reasons.push("missing_geometry");
  if (!row.profileVersion) reasons.push("missing_elevation_profile");
  if (row.rightsClassification !== "reusable_geometry" || !row.geometryReuseAllowed) {
    reasons.push("rights_unclear");
  }
  return reasons;
}

export function buildCanonicalRouteRecord(
  rows: readonly RouteRecordRow[],
): CanonicalRouteRecordResponse {
  if (rows.length === 0) {
    return { status: "unavailable", reasons: ["version_not_found"], record: null };
  }
  if (rows.length > 1) {
    return { status: "ambiguous", reasons: ["ambiguous_lookup"], record: null };
  }
  const row = rows[0];
  if (
    row.mountainStatus !== "verified" ||
    row.routeStatus !== "verified" ||
    row.definitionStatus !== "verified" ||
    row.factStatus !== "verified" ||
    !row.evidenceId ||
    !row.publisher ||
    !row.evidenceTitle ||
    !row.evidenceUrl ||
    row.factVersion !== row.definitionVersion ||
    row.routeVersion !== row.definitionVersion
  ) {
    return { status: "unavailable", reasons: ["needs_review"], record: null };
  }

  const reasons = reasonList(row);
  const provenance = {
    provider: row.publisher ?? "Summit Data Engine",
    sourceUrl: row.evidenceUrl,
    attribution: row.evidenceTitle,
    rightsClassification: row.rightsClassification ?? "unclear",
    provenanceVersion: row.mountainProvenanceVersion ?? row.routeVersion ?? "unknown",
    qaFlags: [],
  };
  const evidence = {
    evidenceId: row.evidenceId ?? "unknown",
    evidenceType: "source",
    ...provenance,
  };
  const geometrySources = (row.geometrySourceMembers ?? []).map(member => {
    const { evidenceId: _ignoredEvidenceId, ...safeMember } = member;
    return {
      ...provenance,
      ...safeMember,
      evidenceType: "source" as const,
    };
  });
  const profileSources = (row.profileSourceMembers ?? []).map(member => ({
    ...evidence,
    ...member,
    evidenceType: "dem" as const,
  }));
  const routeId = stableRouteId(row.routeIdentityKey!, row.routeVersion!);
  const mountainId = stableMountainId(row.mountainId!);
  const record = {
    mountain: {
      id: mountainId,
      canonicalName: row.mountainName,
      aliases: [],
      verification: {
        engineStatus: "verified",
        productLifecycle: "summitready_verified",
        qaFlags: [],
      },
      provenance,
      routes: [{
        version: { identityKey: row.routeIdentityKey, version: row.routeVersion, routeId, mountainId },
        canonicalName: row.routeName,
        status: "verified",
        availability: reasons.length ? "degraded" : "available",
      }],
    },
    route: {
      version: { identityKey: row.routeIdentityKey, version: row.routeVersion, routeId, mountainId },
      canonicalName: row.routeName,
      aliases: row.routeAliases ?? [],
      status: "verified",
      provenance,
    },
    definition: {
      identity: {
        version: { identityKey: row.routeIdentityKey, version: row.routeVersion, routeId, mountainId },
        canonicalName: row.routeName,
        aliases: row.routeAliases ?? [],
        status: "verified",
        provenance,
      },
      definitionVersion: row.definitionVersion,
      definitionKey: row.definitionKey,
      description: row.definitionDescription,
      evidence: [evidence],
      status: "verified",
    },
    facts: {
      distanceM: row.distanceKm == null ? undefined : row.distanceKm * 1000,
      ascentM: row.totalAscentM ?? undefined,
      descentM: row.totalDescentM ?? undefined,
      startElevationM: row.startElevationM ?? undefined,
      summitElevationM: row.summitElevationM ?? undefined,
      typicalDurationS: row.typicalDurationHours == null ? undefined : row.typicalDurationHours * 3600,
    },
    geometry: row.geometry &&
      row.rightsClassification === "reusable_geometry" &&
      row.geometryReuseAllowed === true &&
      row.geometryValidationPassed === true &&
      geometrySources.length
      ? {
          geometryVersion: row.geometryVersion ?? row.definitionVersion,
          coordinateReferenceSystem: "EPSG:4326",
          coordinates: row.geometry.coordinates ?? [],
          direction: "unknown",
          derivationMethod: row.geometryDerivationMethod ?? "sde",
           sourceMembers: geometrySources,
          topologyStatus: "complete",
        }
      : undefined,
    elevationProfile: row.profileVersion && profileSources.length
      ? {
          profileVersion: row.profileVersion,
          samples: row.profileSamples ?? [],
          spacingM: row.profileSpacingM ?? undefined,
          calculationVersion: row.profileCalculationVersion ?? row.profileVersion,
          nodataCount: row.profileNodataCount ?? 0,
           demSources: profileSources,
        }
      : undefined,
    trust: {
      engineStatus: "verified",
      productLifecycle: "summitready_verified",
      evidence: [evidence],
      rightsClassification: row.rightsClassification ?? "unclear",
    },
    attribution: [provenance],
    source: "canonical",
    requestedVersion: row.routeVersion,
  };
  return {
    status: reasons.length ? "degraded" : "available",
    reasons,
    record,
  };
}

export const queryCanonicalRouteRecord: CanonicalRouteRecordQuery = async (
  identityKey,
  version,
  mountainId,
) => {
  const query = sql`
    SELECT * FROM (${ROUTE_RECORD_SQL}) AS route_record
    WHERE "routeIdentityKey" = ${identityKey}
      AND "routeVersion" = ${version}
      AND "mountainId" = ${mountainId}
    LIMIT 2
  `;
  return executeEngineReadOnly<RouteRecordRow>(query);
};

export function createCanonicalRouteRecordHandler(
  query: CanonicalRouteRecordQuery = queryCanonicalRouteRecord,
) {
  return async (identityKey: string, version: string, mountainId: string) => {
    try {
      return buildCanonicalRouteRecord(await query(identityKey, version, mountainId));
    } catch {
      return { status: "unavailable", reasons: ["service_unavailable"], record: null };
    }
  };
}