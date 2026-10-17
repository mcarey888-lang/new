import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@clerk/express";
import { authMode, requireAuth } from "../middlewares/requireAuth";
import type { Request, Response, NextFunction } from "express";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn(), requireAuth: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("route API authentication", () => {
  const request = () => ({ headers: { authorization: "Bearer fixture-token" }, log: { warn: vi.fn(), error: vi.fn() } }) as unknown as Request;
  const response = () => {
    const res = { status: vi.fn(), json: vi.fn(), getHeader: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  };
  it("returns JSON 401 rather than redirecting a rejected token", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const res = response(), next = vi.fn();
    requireAuth({ json: true })(request(), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining("sign in again") });
    expect(next).not.toHaveBeenCalled();
  });
  it("allows only the user identity already verified by Clerk", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
    vi.mocked(getAuth).mockReturnValue({ userId: "user_fixture" } as ReturnType<typeof getAuth>);
    const res = response(), next = vi.fn();
    requireAuth({ json: true })(request(), res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
  it("logs opt-in QA metadata but still rejects an unverified token with generic JSON", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_privateFixture");
    vi.stubEnv("CORS_ALLOW_LOOPBACK", "true");
    vi.stubEnv("CLERK_PUBLISHABLE_KEY", `pk_live_${Buffer.from("clerk.example.test$").toString("base64")}`);
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    // Even a JWT-shaped bearer asserting a user identity is NOT authenticated.
    const jwt = `${encode({ kid: "ins_DevelopmentFixture" })}.${encode({
      iss: "https://development.example.test", azp: "http://localhost:8081", sub: "user_private",
    })}.notASignature`;
    const req = request(), res = response(), next = vi.fn();
    req.headers.origin = "http://localhost:8081";
    req.headers.authorization = `Bearer ${jwt}`;
    res.getHeader.mockImplementation((name: string) =>
      name === "x-clerk-auth-reason" ? "jwk-kid-mismatch"
        : "The following kid is available: ins_ProductionFixture");
    requireAuth({ json: true })(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Your sign-in could not be verified. Please sign in again to save routes.",
    });
    expect(req.log.warn).toHaveBeenCalledWith(expect.objectContaining({
      authReason: "jwk-kid-mismatch",
      qaAuthDiagnostics: expect.objectContaining({
        unverifiedTokenIssuerOrigin: "https://development.example.test",
        unverifiedTokenSigningKeyId: "ins_DevelopmentFixture",
        availableVerificationKeyIds: ["ins_ProductionFixture"],
      }),
    }), "route API authentication rejected");
    expect(JSON.stringify(vi.mocked(req.log.warn).mock.calls)).not.toContain(jwt);
    expect(JSON.stringify(vi.mocked(req.log.warn).mock.calls)).not.toContain("user_private");
  });
  it("fails closed if authentication cannot be checked", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
    vi.mocked(getAuth).mockImplementation(() => { throw new Error("private diagnostic"); });
    const res = response(), next = vi.fn();
    requireAuth({ json: true })(request(), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "authentication_unavailable" });
    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * Which way this fails is the whole point.
 *
 * The rule it replaces enforced only for a key starting with `sk_live_`, and
 * waved everything else through. A production box with the key missing or
 * mid-rotation would have stopped checking anybody, silently.
 */
describe("choosing how to treat a request", () => {
  it("enforces with a live key", () => {
    expect(authMode({ CLERK_SECRET_KEY: "sk_live_abc", NODE_ENV: "production" })).toBe("enforce");
  });

  it("enforces with a test key too", () => {
    /* A preview build signs in with a test key and sends real sessions. The
       old rule treated those requests as needing no check at all. */
    expect(authMode({ CLERK_SECRET_KEY: "sk_test_abc", NODE_ENV: "production" })).toBe("enforce");
    expect(authMode({ CLERK_SECRET_KEY: "sk_test_abc", NODE_ENV: "development" })).toBe("enforce");
  });

  it("refuses in production when the key is missing", () => {
    for (const key of [undefined, "", "   "]) {
      expect(authMode({ CLERK_SECRET_KEY: key, NODE_ENV: "production" })).toBe("refuse");
    }
  });

  it("never waves anything through in production", () => {
    /* The single most important line here. */
    for (const key of [undefined, "", "sk_live_x", "sk_test_x", "whatever"]) {
      expect(authMode({ CLERK_SECRET_KEY: key, NODE_ENV: "production" }))
        .not.toBe("allow_unauthenticated");
    }
  });

  it("stays out of the way locally and under test", () => {
    expect(authMode({ NODE_ENV: "development" })).toBe("allow_unauthenticated");
    expect(authMode({ NODE_ENV: "test" })).toBe("allow_unauthenticated");
    expect(authMode({})).toBe("allow_unauthenticated");
  });
});
