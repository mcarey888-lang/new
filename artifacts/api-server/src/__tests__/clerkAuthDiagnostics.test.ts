import { describe, expect, it } from "vitest";
import { getLoopbackAuthDiagnostics } from "../lib/clerkAuthDiagnostics";

const issuer = "https://development-example.clerk.accounts.dev";
const keyId = "ins_ExampleDevelopment";
const expectedKeyId = "ins_ExampleProduction";
const publishableKey = `pk_live_${Buffer.from("clerk.example.test$").toString("base64")}`;
const environment = {
  NODE_ENV: "production",
  CORS_ALLOW_LOOPBACK: "true",
  CLERK_PUBLISHABLE_KEY: publishableKey,
  CLERK_SECRET_KEY: "sk_live_privateFixtureDoNotLog",
  CLERK_JWT_KEY: "privateFixtureVerificationKeyDoNotLog",
};
const token = (header: unknown, payload: unknown) =>
  [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .concat("signatureDoNotLog").join(".");
const bearer = `Bearer ${token({ kid: keyId, alg: "RS256" }, {
  iss: issuer, azp: "http://localhost:8081", sub: "user_PrivateDoNotLog",
  email: "private@example.test", metadata: "privateDoNotLog",
})}`;
const input = {
  origin: "http://localhost:8081",
  authorization: bearer,
  verificationMessage: `Clerk verification failed. The following kid is available: ${expectedKeyId}`,
};

describe("private loopback Clerk diagnostics", () => {
  it("logs only selected public metadata, key modes and verifier IDs", () => {
    expect(getLoopbackAuthDiagnostics(input, environment)).toEqual({
      requestOrigin: "http://localhost:8081",
      unverifiedTokenIssuerOrigin: issuer,
      unverifiedTokenAuthorizedPartyOrigin: "http://localhost:8081",
      unverifiedTokenSigningKeyId: keyId,
      configuredClerkFrontendOrigin: "https://clerk.example.test",
      configuredPublishableKeyMode: "live",
      configuredSecretKeyMode: "live",
      localJwtVerificationKeyConfigured: true,
      availableVerificationKeyIds: [expectedKeyId],
    });
  });

  it("never includes JWTs, signatures, identity claims, keys or raw messages", () => {
    const output = JSON.stringify(getLoopbackAuthDiagnostics({
      ...input,
      verificationMessage: `privateErrorDoNotLog token=${bearer}. The following kid is available: ${expectedKeyId}`,
    }, environment));
    for (const secret of [
      bearer, bearer.slice(7), "signatureDoNotLog", "user_PrivateDoNotLog",
      "private@example.test", "privateDoNotLog", "privateErrorDoNotLog",
      publishableKey, environment.CLERK_SECRET_KEY, environment.CLERK_JWT_KEY,
    ]) expect(output).not.toContain(secret);
  });

  it.each([undefined, "false", "TRUE", "1"])("requires the exact opt-in flag: %s", flag => {
    expect(getLoopbackAuthDiagnostics(input, {
      ...environment, NODE_ENV: "development", CORS_ALLOW_LOOPBACK: flag,
    })).toBeUndefined();
  });

  it.each([
    undefined, "https://summitready.uk", "http://localhost.evil.test:8081",
    "http://192.168.1.2:8081", "null", "http://localhost:8081/path",
  ])("does not decode tokens for non-loopback requests: %s", origin => {
    expect(getLoopbackAuthDiagnostics({ ...input, origin }, environment)).toBeUndefined();
  });

  it("also supports explicitly opted-in 127.0.0.1 origins", () => {
    expect(getLoopbackAuthDiagnostics({
      ...input, origin: "http://127.0.0.1:8081",
    }, environment)?.requestOrigin).toBe("http://127.0.0.1:8081");
  });

  it.each([
    undefined, "Basic privateDoNotLog", "Bearer malformed", "Bearer e30.e30",
    "Bearer bm90IGpzb24.e30.signature", "Bearer bnVsbA.W10.signature",
    `Bearer ${"a".repeat(17_000)}`,
  ])("tolerates absent, malformed and oversized tokens without throwing", authorization => {
    const diagnostic = getLoopbackAuthDiagnostics({ ...input, authorization }, environment);
    expect(diagnostic?.unverifiedTokenIssuerOrigin).toBeNull();
    expect(diagnostic?.unverifiedTokenAuthorizedPartyOrigin).toBeNull();
    expect(diagnostic?.unverifiedTokenSigningKeyId).toBeNull();
  });

  it("strips paths and queries and refuses URL credentials or arbitrary key IDs", () => {
    const diagnostic = getLoopbackAuthDiagnostics({
      ...input,
      authorization: `Bearer ${token({ kid: "secret@example.test" }, {
        iss: "https://issuer.example.test/private?token=privateDoNotLog",
        azp: "http://name:privateDoNotLog@localhost:8081",
      })}`,
    }, environment);
    expect(diagnostic?.unverifiedTokenIssuerOrigin).toBe("https://issuer.example.test");
    expect(diagnostic?.unverifiedTokenAuthorizedPartyOrigin).toBeNull();
    expect(diagnostic?.unverifiedTokenSigningKeyId).toBeNull();
    expect(JSON.stringify(diagnostic)).not.toContain("privateDoNotLog");
  });

  it("tolerates missing or malformed configured keys", () => {
    const diagnostic = getLoopbackAuthDiagnostics(input, {
      ...environment,
      CLERK_PUBLISHABLE_KEY: "malformed",
      CLERK_SECRET_KEY: undefined,
      CLERK_JWT_KEY: undefined,
    });
    expect(diagnostic?.configuredClerkFrontendOrigin).toBeNull();
    expect(diagnostic?.configuredPublishableKeyMode).toBe("unrecognized");
    expect(diagnostic?.configuredSecretKeyMode).toBe("missing");
    expect(diagnostic?.localJwtVerificationKeyConfigured).toBe(false);
  });

  it("only retains bounded public verifier IDs, not arbitrary error text", () => {
    const diagnostic = getLoopbackAuthDiagnostics({
      ...input,
      verificationMessage: `The following kid is available: ${expectedKeyId}, private@example.test, ins_AnotherKey`,
    }, environment);
    expect(diagnostic?.availableVerificationKeyIds).toEqual([expectedKeyId, "ins_AnotherKey"]);
    expect(getLoopbackAuthDiagnostics({
      ...input, verificationMessage: `The following kid is available: ${"a".repeat(5000)}`,
    }, environment)?.availableVerificationKeyIds).toEqual([]);
    expect(getLoopbackAuthDiagnostics({
      ...input, verificationMessage: "different SDK wording",
    }, environment)?.availableVerificationKeyIds).toEqual([]);
  });
});
