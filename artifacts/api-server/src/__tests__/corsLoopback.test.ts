import { describe, expect, it } from "vitest";
import { isLoopbackCorsOrigin } from "../lib/corsPolicy.js";

describe("opt-in loopback CORS", () => {
  const production = { NODE_ENV: "production" };
  it("leaves production closed by default", () => {
    expect(isLoopbackCorsOrigin("http://localhost:8081", production)).toBe(false);
    expect(isLoopbackCorsOrigin("https://127.0.0.1:443", production)).toBe(false);
  });
  it("preserves development loopback access", () => {
    expect(isLoopbackCorsOrigin("http://localhost:8081", { NODE_ENV: "development" })).toBe(true);
  });
  it.each(["http://localhost:8081", "https://localhost", "http://127.0.0.1:3000"])(
    "allows %s with the exact opt-in without changing NODE_ENV", origin => {
      expect(isLoopbackCorsOrigin(origin, { ...production, CORS_ALLOW_LOOPBACK: "true" })).toBe(true);
      expect(production.NODE_ENV).toBe("production");
    },
  );
  it.each(["false", "", "TRUE", "1"])("does not opt in for %s", value => {
    expect(isLoopbackCorsOrigin("http://localhost:3000", { ...production, CORS_ALLOW_LOOPBACK: value })).toBe(false);
  });
  it.each([
    "http://localhost.evil.test:3000", "http://127.0.0.1.evil.test",
    "http://192.168.1.2:3000", "http://0.0.0.0:3000", "null",
    "file://localhost", "http://user@localhost:3000", "http://localhost:3000/path",
    "http://localhost:3000?evil=true",
  ])("never opens other origins: %s", origin => {
    expect(isLoopbackCorsOrigin(origin, { ...production, CORS_ALLOW_LOOPBACK: "true" })).toBe(false);
  });
});
