import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/(auth)/sign-up.tsx", import.meta.url), "utf8");
const create = source.slice(source.indexOf("async function handleSignUp()"), source.indexOf("async function handleVerify()"));

describe("sign-up security-check progress", () => {
  it("explains the wait before invoking Clerk, rather than leaving an unexplained spinner", () => {
    expect(create.indexOf('setSignUpPhase("security")')).toBeLessThan(create.indexOf("signUp.create("));
    expect(source).toContain("Verifying you're human… Complete the security check below if it appears.");
    expect(source).toContain('accessibilityLiveRegion="polite"');
    expect(source).toContain('Platform.OS === "web" && loading && signUpPhase');
  });
  it("changes the explanation after the check, and clears it on success, error or timeout", () => {
    expect(create.indexOf('setSignUpPhase("email")')).toBeGreaterThan(create.indexOf("if (createErr)"));
    expect(create.indexOf('setSignUpPhase("email")')).toBeLessThan(create.indexOf("signUp.verifications.sendEmailCode()"));
    expect(source).toContain("Sending your verification code…");
    expect(create).toMatch(/finally\s*\{\s*setSignUpPhase\(null\);\s*setLoading\(false\);/);
  });
  it("keeps one unconditional Clerk challenge host mounted next to the submit button", () => {
    expect(source.match(/nativeID="clerk-captcha"/g)).toHaveLength(1);
    const button = source.indexOf('<Text style={s.btnText}>Create account</Text>');
    const status = source.indexOf('testID="sign-up-progress"');
    const captcha = source.indexOf('nativeID="clerk-captcha"');
    expect(status).toBeGreaterThan(button);
    expect(captcha).toBeGreaterThan(status);
    expect(source.slice(status, captcha)).toMatch(/<\/Text>\s*\)\}\s*<View/);
  });
  it("preserves credential validation, original timeouts, email verification and navigation", () => {
    expect(create).toContain("password.length < 8");
    expect(create).toContain("signUp.create({ emailAddress: email.trim(), password })");
    expect(create.match(/20000,/g)).toHaveLength(2);
    expect(create).toContain("setNeedsVerification(true)");
    expect(source).toContain("finishAuthentication();");
  });
});
