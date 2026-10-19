import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicDisplayName, editableDisplayName, MEMBER_NAME } from "./publicDisplayName";

describe("public display name privacy", () => {
  it("never falls back to the login email, including email-only accounts", () => {
    const account = { firstName: null, username: null,
      primaryEmailAddress: { emailAddress: "private@example.test" },
      fullName: "private@example.test" };
    expect(publicDisplayName(account)).toBe(MEMBER_NAME);
    expect(publicDisplayName(null)).toBe(MEMBER_NAME);
  });
  it.each([
    { firstName: "private@example.test" },
    { username: "private@example.test" },
    { firstName: "Alice", lastName: "private@example.test" },
    { firstName: " ", lastName: "", username: " " },
  ])("protects legacy identity fields without rewriting records: %j", user => {
    const before = JSON.stringify(user);
    expect(publicDisplayName(user)).toBe(MEMBER_NAME);
    expect(JSON.stringify(user)).toBe(before);
  });
  it("keeps ordinary and OAuth names and non-email usernames", () => {
    expect(publicDisplayName({ firstName: " Alice ", lastName: "Walker " })).toBe("Alice Walker");
    expect(publicDisplayName({ username: "hillwalker" })).toBe("hillwalker");
    expect(publicDisplayName({ firstName: "private@example.test", username: "hillwalker" })).toBe("hillwalker");
  });
  it("honours a name explicitly chosen in Edit profile, including a deliberately public email", () => {
    expect(publicDisplayName({ firstName: "Old", unsafeMetadata: {
      summitReadyDisplayName: " New name ",
    } })).toBe("New name");
    expect(publicDisplayName({ unsafeMetadata: {
      summitReadyDisplayName: "chosen@example.test",
    } })).toBe("chosen@example.test");
  });
  it("does not accept unrelated or malformed metadata as email-publication consent", () => {
    expect(publicDisplayName({ firstName: "private@example.test",
      unsafeMetadata: { displayName: "private@example.test", summitReadyDisplayName: true },
    })).toBe(MEMBER_NAME);
  });
  it("does not prefill legacy email names or the generic fallback in the public-name editor", () => {
    expect(editableDisplayName({ firstName: "private@example.test" })).toBe("");
    expect(editableDisplayName(null)).toBe("");
    expect(editableDisplayName({ firstName: "Alice" })).toBe("Alice");
    expect(editableDisplayName({ unsafeMetadata: { summitReadyDisplayName: "chosen@example.test" } }))
      .toBe("chosen@example.test");
  });
  it("wires both profile and greeting to the safe resolver, not login identity", () => {
    for (const path of ["../app/(tabs)/account.tsx", "../app/(expedition)/base-camp.tsx"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("publicDisplayName(user)");
      expect(source).not.toContain('?? displayEmail ?? "Account"');
    }
  });
  it("requires an actual name change before recording explicit consent and preserves other metadata", () => {
    const source = readFileSync(new URL("../app/edit-profile.tsx", import.meta.url), "utf8");
    expect(source).toContain("if(name.trim()!==editableDisplayName(user))");
    expect(source).toContain("...user.unsafeMetadata,summitReadyDisplayName:name.trim()||null");
    expect(source).toContain("Only enter an email address here if you want other members to see it.");
  });
});
