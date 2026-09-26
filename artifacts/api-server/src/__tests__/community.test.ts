import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canReadCommunityPost,
  canReportCommunityPost,
  isHiddenByReport,
  isValidCommunityPostContent,
  matchesCommunityImageFormat,
  resolveUniqueCommunityAuthors,
} from "../services/communityPolicy";

const routeSource = readFileSync(new URL("../routes/community.ts", import.meta.url), "utf8");

describe("community member sharing policy", () => {
  it("requires an explicit Clerk user id check in every member route, including media GET", () => {
    const routes = [...routeSource.matchAll(/router\.(?:get|post|put|patch|delete)\s*\(\s*"([^"]+)"/g)];
    expect(routes).toHaveLength(7);
    for (const route of routes) {
      const start = route.index ?? 0;
      const nextRoute = routeSource.indexOf("\nrouter.", start + 1);
      const handler = routeSource.slice(start, nextRoute < 0 ? undefined : nextRoute);
      expect(handler).toContain("requireMember(req, res)");
    }
    expect(routeSource).toMatch(/const \{ userId \} = getAuth\(req\);[\s\S]*?res\.status\(401\)/);
    expect(routeSource).toContain('"/community/posts/:id/photo"');
  });

  it("hides another owner's private post and allows member-visible posts", () => {
    const privatePost = { ownerUserId: "owner-a", visibility: "private" };
    const memberPost = { ownerUserId: "owner-a", visibility: "members" };
    expect(canReadCommunityPost(privatePost, "owner-a")).toBe(true);
    expect(canReadCommunityPost(privatePost, "owner-b")).toBe(false);
    expect(canReadCommunityPost(memberPost, "owner-b")).toBe(true);
  });

  it("keeps member and mine feeds bounded and hides previously reported posts only from the reporter", () => {
    expect(routeSource.match(/\.limit\(50\)/g)).toHaveLength(2);
    const reported = new Set(["post-a"]);
    expect(isHiddenByReport({ id: "post-a", ownerUserId: "owner-a" }, "reporter", reported)).toBe(true);
    expect(isHiddenByReport({ id: "post-a", ownerUserId: "reporter" }, "reporter", reported)).toBe(false);
    expect(isHiddenByReport({ id: "post-b", ownerUserId: "owner-a" }, "reporter", reported)).toBe(false);
  });

  it("validates nonempty story and badge text and bounds badge identifiers and titles", () => {
    expect(isValidCommunityPostContent({ kind: "story", text: "  ", badgeId: null, badgeTitle: null })).toBe(false);
    expect(isValidCommunityPostContent({ kind: "badge", text: "", badgeId: null, badgeTitle: null })).toBe(false);
    expect(isValidCommunityPostContent({ kind: "story", text: "A story", badgeId: null, badgeTitle: null })).toBe(true);
    expect(isValidCommunityPostContent({ kind: "badge", text: "A badge", badgeId: "a".repeat(128), badgeTitle: "b".repeat(160) })).toBe(true);
    expect(isValidCommunityPostContent({ kind: "badge", text: "A badge", badgeId: "a".repeat(129), badgeTitle: null })).toBe(false);
    expect(isValidCommunityPostContent({ kind: "badge", text: "A badge", badgeId: null, badgeTitle: "b".repeat(161) })).toBe(false);
    expect(isValidCommunityPostContent({ kind: "story", text: "x".repeat(601), badgeId: null, badgeTitle: null })).toBe(false);
    expect(isValidCommunityPostContent({ kind: "photo", text: "", badgeId: null, badgeTitle: null })).toBe(true);
  });

  it("looks up one Clerk author profile for repeated post owners", async () => {
    const lookups: string[] = [];
    const authors = await resolveUniqueCommunityAuthors(["owner-a", "owner-a", "owner-b"], async (id) => {
      lookups.push(id);
      return { name: id };
    });
    expect(lookups).toEqual(["owner-a", "owner-b"]);
    expect(authors.get("owner-a")).toEqual({ name: "owner-a" });
  });

  it("permits reports only against another member-visible post", () => {
    expect(canReportCommunityPost({ ownerUserId: "owner-a", visibility: "members" }, "owner-b")).toBe(true);
    expect(canReportCommunityPost({ ownerUserId: "owner-a", visibility: "private" }, "owner-b")).toBe(false);
    expect(canReportCommunityPost({ ownerUserId: "owner-a", visibility: "members" }, "owner-a")).toBe(false);
    expect(routeSource).toContain("onConflictDoNothing");
    expect(routeSource).toContain("eq(communityReports.reporterUserId, userId)");
  });

  it("scopes visibility edits, deletion, and uploads to the authenticated owner", () => {
    expect(routeSource).toContain("eq(communityPosts.ownerUserId, userId)");
    expect(routeSource).toContain("eq(communityPosts.ownerUserId, userId),\n        isNull(communityPosts.photoPath)");
  });

  it("rejects media whose claimed content type does not match its decoded format", () => {
    expect(matchesCommunityImageFormat("image/jpeg", "jpeg")).toBe(true);
    expect(matchesCommunityImageFormat("image/png", "png")).toBe(true);
    expect(matchesCommunityImageFormat("image/webp", "webp")).toBe(true);
    expect(matchesCommunityImageFormat("image/jpeg", "png")).toBe(false);
    expect(matchesCommunityImageFormat("image/gif", "gif")).toBe(false);
    expect(matchesCommunityImageFormat("image/png", undefined)).toBe(false);
  });
});