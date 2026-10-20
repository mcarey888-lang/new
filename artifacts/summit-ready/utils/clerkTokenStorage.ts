/**
 * Client JWTs belong to one Clerk instance. The public key is not a secret,
 * but encode it so every resulting SecureStore key uses supported characters.
 * Do not migrate the old unscoped cache: its issuer cannot be assumed safe.
 */
export function clerkTokenStoragePrefix(publishableKey: string | undefined): string {
  const namespace = publishableKey
    ? Array.from(publishableKey, char =>
      char.charCodeAt(0).toString(16).padStart(4, "0"),
    ).join("")
    : "unconfigured";
  return `summitready_clerk_v3_${namespace}_`;
}
