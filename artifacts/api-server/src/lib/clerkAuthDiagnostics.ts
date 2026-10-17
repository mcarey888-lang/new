import { parsePublishableKey } from "@clerk/shared/keys";
import { isLoopbackCorsOrigin } from "./corsPolicy";

type DiagnosticEnvironment = {
  NODE_ENV?: string | undefined;
  CORS_ALLOW_LOOPBACK?: string | undefined;
  CLERK_PUBLISHABLE_KEY?: string | undefined;
  CLERK_SECRET_KEY?: string | undefined;
  CLERK_JWT_KEY?: string | undefined;
};

/** Retain an origin only: never log URL credentials, paths or query strings. */
function safeOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function signingKeyId(value: unknown): string | null {
  // Clerk instance IDs are public JWKS key IDs. Do not log arbitrary kid text.
  return typeof value === "string" && /^ins_[A-Za-z0-9]{1,64}$/.test(value)
    ? value
    : null;
}

function keyMode(value: string | undefined, prefix: "pk" | "sk") {
  if (!value) return "missing";
  if (value.startsWith(`${prefix}_live_`)) return "live";
  if (value.startsWith(`${prefix}_test_`)) return "test";
  return "unrecognized";
}

function configuredFrontendOrigin(key: string | undefined): string | null {
  try {
    const parsed = parsePublishableKey(key, { fatal: false });
    return parsed ? safeOrigin(`https://${parsed.frontendApi}`) : null;
  } catch {
    return null;
  }
}

function tokenMetadata(authorization: string | undefined) {
  const empty = {
    unverifiedTokenIssuerOrigin: null as string | null,
    unverifiedTokenAuthorizedPartyOrigin: null as string | null,
    unverifiedTokenSigningKeyId: null as string | null,
  };
  // Decoding is diagnostic only. It MUST NOT supply identity or authorize access.
  if (!authorization || authorization.length > 16_384) return empty;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  const parts = match?.[1]?.split(".");
  if (!parts || parts.length !== 3) return empty;
  try {
    const decode = (part: string) => {
      if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error("invalid encoding");
      const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("invalid metadata");
      }
      return value as Record<string, unknown>;
    };
    const header = decode(parts[0]!);
    const payload = decode(parts[1]!);
    return {
      unverifiedTokenIssuerOrigin: safeOrigin(payload.iss),
      unverifiedTokenAuthorizedPartyOrigin: safeOrigin(payload.azp),
      unverifiedTokenSigningKeyId: signingKeyId(header.kid),
    };
  } catch {
    return empty;
  }
}

function availableVerificationKeyIds(message: unknown): string[] {
  if (typeof message !== "string" || message.length > 4096) return [];
  // Extract only public key IDs from Clerk's error; never log its raw message,
  // which includes request-controlled text. If SDK wording changes, omit IDs.
  const suffix = message.split("The following kid is available: ")[1];
  if (!suffix) return [];
  return suffix.split(/,\s*/).slice(0, 8)
    .map(signingKeyId).filter((id): id is string => id !== null);
}

/**
 * Private server logs only, for owner-approved loopback QA. The flag enables
 * diagnostics, NOT acceptance of tokens from a different Clerk instance.
 */
export function getLoopbackAuthDiagnostics(
  input: {
    origin?: string | undefined;
    authorization?: string | undefined;
    verificationMessage?: unknown;
  },
  environment: DiagnosticEnvironment = process.env,
) {
  if (environment.CORS_ALLOW_LOOPBACK !== "true" ||
      !input.origin || !isLoopbackCorsOrigin(input.origin, environment)) return undefined;

  return {
    requestOrigin: safeOrigin(input.origin),
    ...tokenMetadata(input.authorization),
    configuredClerkFrontendOrigin: configuredFrontendOrigin(environment.CLERK_PUBLISHABLE_KEY),
    configuredPublishableKeyMode: keyMode(environment.CLERK_PUBLISHABLE_KEY, "pk"),
    configuredSecretKeyMode: keyMode(environment.CLERK_SECRET_KEY, "sk"),
    localJwtVerificationKeyConfigured: Boolean(environment.CLERK_JWT_KEY?.trim()),
    availableVerificationKeyIds: availableVerificationKeyIds(input.verificationMessage),
  };
}
