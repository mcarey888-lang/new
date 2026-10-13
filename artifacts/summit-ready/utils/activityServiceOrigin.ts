export function resolveActivityApiBase(config: { mapBase?: string; domain?: string }): string {
  return (config.mapBase?.trim() || (config.domain ? `https://${config.domain}/api` : "/api")).replace(/\/+$/, "");
}
/** All owned recording operations, including previously queued retries,
 * use this service. The general app/AI origin is deliberately separate. */
export const activityApiBase = resolveActivityApiBase({
  mapBase: process.env.EXPO_PUBLIC_MAP_BASE, domain: process.env.EXPO_PUBLIC_DOMAIN,
});
