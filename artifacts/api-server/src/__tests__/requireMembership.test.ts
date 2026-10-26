import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAuth } from "@clerk/express";
import { verifiedMembership } from "../services/membershipAccess";
import { requireMembership } from "../middlewares/requireMembership";
import { accessFromEntitlements } from "@workspace/membership";

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("../services/membershipAccess", () => ({ verifiedMembership: vi.fn() }));

beforeEach(() => {
  vi.mocked(getAuth).mockReturnValue({ userId: "owner" } as any);
  vi.mocked(verifiedMembership).mockResolvedValue(accessFromEntitlements([]));
});

async function run(feature: "training" | "expedition") {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await requireMembership(feature)({ body: { free: true, tier: "pro" } } as any, res as any, next);
  return { res, next };
}

describe("paid backend boundaries", () => {
  it("requires authenticated identity, not a supplied free/tier flag", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);
    const { res, next } = await run("training");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("denies free users regardless of client-supplied tier", async () => {
    expect((await run("expedition")).res.status).toHaveBeenCalledWith(403);
  });
  it("middle tier cannot call personalised training endpoints", async () => {
    vi.mocked(verifiedMembership).mockResolvedValue(accessFromEntitlements(["expeditions"]));
    expect((await run("training")).res.status).toHaveBeenCalledWith(403);
    expect((await run("expedition")).next).toHaveBeenCalled();
  });
  it("legacy subscribers retain training and expedition API access", async () => {
    vi.mocked(verifiedMembership).mockResolvedValue(accessFromEntitlements(["premium"]));
    expect((await run("training")).next).toHaveBeenCalled();
    expect((await run("expedition")).next).toHaveBeenCalled();
  });
  it("verification outage returns retryable 503, not a false downgrade or free bypass", async () => {
    vi.mocked(verifiedMembership).mockRejectedValue(new Error("offline"));
    const { res, next } = await run("training");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
