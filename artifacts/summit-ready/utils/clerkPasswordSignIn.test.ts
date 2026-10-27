import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the real handlers, with Clerk replaced by a deterministic resource.
// No credentials, accounts, email deliveries or production requests are used.
const source = readFileSync(join(__dirname, "../app/(auth)/sign-in.tsx"), "utf8");
const helper = source.slice(source.indexOf("function getClerkErrorMessage("), source.indexOf("export default"));
function handler(name: "handleSignIn" | "handleVerify", context: object) {
  const start = source.indexOf(`  async function ${name}()`);
  const end = source.indexOf(name === "handleSignIn"
    ? "  async function handleVerify()" : "  const handleGoogle", start);
  const js = ts.transpileModule(helper + source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(`${js}\n${name}`, context) as () => Promise<void>;
}

function fixture(nextStatus = "complete") {
  const signIn = {
    status: "needs_identifier",
    password: vi.fn(async (_input: unknown) => {
      signIn.status = nextStatus;
      return { error: null as unknown };
    }),
    finalize: vi.fn(async () => ({ error: null as unknown })),
    mfa: {
      sendEmailCode: vi.fn(async () => ({ error: null as unknown })),
      verifyEmailCode: vi.fn(async (_input: unknown) => {
        signIn.status = "complete";
        return { error: null as unknown };
      }),
    },
  };
  return {
    signIn, clerkLoaded: true,
    email: " member@example.test ", password: "synthetic-test-password", verifyCode: "424242",
    openedAtRef: { current: Date.now() },
    authUnavailableMessage: () => "Authentication is still loading.",
    withTimeout: (promise: Promise<unknown>) => promise,
    setLoading: vi.fn(), setError: vi.fn(), setNeedsMFA: vi.fn(),
    logLogin: vi.fn(), finishAuthentication: vi.fn(),
  };
}

describe("password sign-in continuation", () => {
  it.each(["needs_client_trust", "needs_second_factor"])(
    "sends an email code for %s without activating a session",
    async status => {
      const ctx = fixture(status);
      await handler("handleSignIn", ctx)();
      expect(ctx.signIn.password).toHaveBeenCalledWith({
        emailAddress: "member@example.test", password: "synthetic-test-password",
      });
      expect(ctx.signIn.mfa.sendEmailCode).toHaveBeenCalledOnce();
      expect(ctx.setNeedsMFA).toHaveBeenCalledWith(true);
      expect(ctx.signIn.finalize).not.toHaveBeenCalled();
      expect(ctx.finishAuthentication).not.toHaveBeenCalled();
      expect(ctx.setError).not.toHaveBeenCalledWith("Sign-in failed — please try again.");
      expect(ctx.setLoading).toHaveBeenLastCalledWith(false);
    },
  );

  it("finishes an ordinary successful password sign-in", async () => {
    const ctx = fixture();
    await handler("handleSignIn", ctx)();
    expect(ctx.signIn.finalize).toHaveBeenCalledOnce();
    expect(ctx.finishAuthentication).toHaveBeenCalledOnce();
    expect(ctx.signIn.mfa.sendEmailCode).not.toHaveBeenCalled();
  });

  it("shows an actionable reset message when Clerk requires a new password", async () => {
    const ctx = fixture("needs_new_password");
    await handler("handleSignIn", ctx)();
    expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining("Forgot password?"));
    expect(ctx.signIn.finalize).not.toHaveBeenCalled();
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
  });

  it("does not show a sent-code screen if delivery fails", async () => {
    const ctx = fixture("needs_client_trust");
    ctx.signIn.mfa.sendEmailCode.mockResolvedValueOnce({
      error: { errors: [{ longMessage: "Please wait before requesting another code." }] },
    });
    await handler("handleSignIn", ctx)();
    expect(ctx.setError).toHaveBeenCalledWith("Please wait before requesting another code.");
    expect(ctx.setNeedsMFA).not.toHaveBeenCalled();
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
    expect(ctx.setLoading).toHaveBeenLastCalledWith(false);
  });

  it("preserves invalid-password errors rather than starting verification", async () => {
    const ctx = fixture();
    ctx.signIn.password.mockResolvedValueOnce({
      error: { errors: [{ code: "form_password_incorrect", longMessage: "Incorrect password." }] },
    });
    await handler("handleSignIn", ctx)();
    expect(ctx.setError).toHaveBeenCalledWith("Incorrect password.");
    expect(ctx.signIn.mfa.sendEmailCode).not.toHaveBeenCalled();
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
  });

  it("does not continue when finalization fails", async () => {
    const ctx = fixture();
    ctx.signIn.finalize.mockResolvedValueOnce({ error: { message: "Session could not be activated." } });
    await handler("handleSignIn", ctx)();
    expect(ctx.setError).toHaveBeenCalledWith("Session could not be activated.");
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
  });

  it("finalizes only after a new-device verification code succeeds", async () => {
    const ctx = fixture("needs_client_trust");
    await handler("handleSignIn", ctx)();
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
    await handler("handleVerify", ctx)();
    expect(ctx.signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "424242" });
    expect(ctx.signIn.finalize).toHaveBeenCalledOnce();
    expect(ctx.finishAuthentication).toHaveBeenCalledOnce();
  });

  it("keeps the verification step open after an incorrect code", async () => {
    const ctx = fixture("needs_client_trust");
    await handler("handleSignIn", ctx)();
    ctx.signIn.mfa.verifyEmailCode.mockResolvedValueOnce({
      error: { errors: [{ longMessage: "Incorrect verification code." }] },
    });
    await handler("handleVerify", ctx)();
    expect(ctx.setError).toHaveBeenCalledWith("Incorrect verification code.");
    expect(ctx.signIn.finalize).not.toHaveBeenCalled();
    expect(ctx.finishAuthentication).not.toHaveBeenCalled();
  });
});
