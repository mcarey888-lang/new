/**
 * Return a safe diagnostic, never an error message, stack, or database URL.
 * PostgreSQL connection errors can contain credentials.
 */
export function summitReadFailure(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const failure = error as { code?: unknown; message?: unknown };
  if (failure.message === "ENGINE_DATABASE_URL is not configured") return "engine_not_configured";
  const reasons: Record<string, string> = {
    ENOTFOUND: "database_host_unreachable",
    EAI_AGAIN: "database_dns_unavailable",
    ECONNREFUSED: "database_connection_refused",
    ECONNRESET: "database_connection_reset",
    ETIMEDOUT: "database_connection_timeout",
    "28P01": "database_authentication_failed",
    "28000": "database_access_rejected",
    "42501": "database_permission_denied",
    "42P01": "catalogue_table_missing",
    "42703": "catalogue_column_missing",
    "42883": "catalogue_function_missing",
    "3D000": "database_missing",
    "53300": "database_connections_exhausted",
    "57014": "catalogue_query_timeout",
    "57P03": "database_temporarily_unavailable",
  };
  return typeof failure.code === "string" && Object.hasOwn(reasons, failure.code)
    ? reasons[failure.code] ?? "unknown"
    : "unknown";
}
