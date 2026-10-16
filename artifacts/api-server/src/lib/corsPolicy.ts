/** An explicit QA opt-in, not a change to production's environment mode. */
export function isLoopbackCorsOrigin(
  origin: string,
  environment: { NODE_ENV?: string; CORS_ALLOW_LOOPBACK?: string } = process.env,
): boolean {
  return (environment.NODE_ENV === "development" || environment.CORS_ALLOW_LOOPBACK === "true")
    && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin);
}
