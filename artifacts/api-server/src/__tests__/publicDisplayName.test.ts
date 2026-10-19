import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicDisplayName, MEMBER_NAME } from "../lib/publicDisplayName";

describe("server public identity boundary", () => {
  it("redacts legacy email-like names in community responses without changing the user", () => {
    const user = { firstName: "private@example.test", username: "private@example.test" };
    expect(publicDisplayName(user)).toBe(MEMBER_NAME);
    expect(user.firstName).toBe("private@example.test");
    expect(publicDisplayName({})).toBe(MEMBER_NAME);
  });
  it("retains chosen and provider names, allowing email only with explicit profile choice", () => {
    expect(publicDisplayName({ firstName: "Alice", lastName: "Walker" })).toBe("Alice Walker");
    expect(publicDisplayName({ username: "walker" })).toBe("walker");
    expect(publicDisplayName({ firstName: "private@example.test", unsafeMetadata: {
      summitReadyDisplayName: "chosen@example.test",
    } })).toBe("chosen@example.test");
  });
  it("guards both member stories and shared hike authors at the API serialization boundary", () => {
    for (const path of ["../routes/community.ts", "../routes/activity-community.ts"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("publicDisplayName(user)");
      expect(source).not.toContain("|| user.username");
      expect(source).not.toContain("emailAddress");
    }
  });
  it("keeps the standalone native and server implementations identical", () => {
    // Separate runtime roots avoid pulling native dependencies into the server or vice versa.
    const server = readFileSync(new URL("../lib/publicDisplayName.ts", import.meta.url), "utf8");
    const native = readFileSync(new URL("../../../summit-ready/utils/publicDisplayName.ts", import.meta.url), "utf8");
    expect(server).toBe(native);
  });
});
