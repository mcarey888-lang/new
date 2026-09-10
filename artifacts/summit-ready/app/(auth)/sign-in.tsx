import { useAuth, useSignIn, useSSO, useSignUp } from "@clerk/expo";
import * as AppleAuthentication from "expo-apple-authentication";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";
import { withTimeout } from "@/utils/withTimeout";
import { logLogin, useScreenView } from "@/lib/analytics";

WebBrowser.maybeCompleteAuthSession();

/**
 * Pulls a human-readable message out of a Clerk error, whatever shape it
 * arrives in (a thrown error, or the `error` field returned by finalize()).
 * Every auth failure must reach the user: a silently swallowed one leaves the
 * button appearing to do nothing, with no indication of why.
 */
export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const e = err as Record<string, unknown>;
  const first = (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0];
  return first?.longMessage ?? first?.message ?? (e?.message as string) ?? fallback;
}

export default function SignInScreen() {
  useScreenView("sign_in");
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signIn } = useSignIn() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signUp } = useSignUp() as any;
  const { isLoaded: clerkLoaded } = useAuth();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [needsMFA, setNeedsMFA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  async function handleSignIn() {
    if (!clerkLoaded || typeof signIn?.create !== "function") {
      setError("Authentication service is still loading — please wait a moment and try again.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Prefer the status on the awaited result; fall back to the hook object
      // for older Clerk builds that mutate the resource in place.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await withTimeout(
        signIn.password({ emailAddress: email.trim(), password }),
        20000,
      ) as any;
      const status = res?.status ?? signIn.status;

      if (status === "complete") {
        const { error } = await withTimeout(signIn.finalize(), 20000) as any;
        if (error) {
          setError(clerkErrorMessage(error, "Couldn't complete sign-in — please try again."));
          return;
        }
        void logLogin("email");
        router.replace("/(tabs)/dashboard" as any);
      } else if (status === "needs_second_factor") {
        await withTimeout(signIn.mfa.sendEmailCode(), 20000);
        setNeedsMFA(true);
      } else if (status === "needs_first_factor") {
        setError("This account needs a different sign-in method. If you signed up with Google or Apple, use the buttons above.");
      } else {
        setError("Sign-in failed — please try again.");
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const firstClerkErr = (e?.errors as Array<{ code?: string; longMessage?: string; message?: string }>)?.[0];
      const code = firstClerkErr?.code ?? "";
      // Strategy mismatch means the account was created with a social provider (e.g. Google or Apple)
      if (
        code === "strategy_for_user_invalid" ||
        code === "form_strategy_not_permitted" ||
        (firstClerkErr?.message ?? "").toLowerCase().includes("strategy")
      ) {
        setError("This account uses Google or Apple sign-in. Tap the button above to continue.");
      } else {
        const clerkMsg = firstClerkErr?.longMessage ?? firstClerkErr?.message;
        const fallback = (e?.message as string) ?? "Sign-in failed — please try again.";
        setError(clerkMsg ?? fallback);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!clerkLoaded || typeof signIn?.mfa?.verifyEmailCode !== "function") {
      setError("Authentication service is still loading — please wait a moment and try again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await withTimeout(signIn.mfa.verifyEmailCode({ code: verifyCode }), 20000) as any;
      if ((res?.status ?? signIn.status) === "complete") {
        const { error } = await withTimeout(signIn.finalize(), 20000) as any;
        if (error) {
          setError(clerkErrorMessage(error, "Couldn't complete sign-in — please try again."));
          return;
        }
        void logLogin("email_mfa");
        router.replace("/(tabs)/dashboard" as any);
      } else {
        setError("Verification failed — please try again.");
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const msg =
        (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]
          ?.longMessage ??
        (e?.errors as Array<{ message?: string }>)?.[0]?.message ??
        (e?.message as string) ??
        "Verification failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      // No timeout here: the user is interacting with an on-screen browser
      // (Google's account picker / password / 2FA), which can legitimately
      // take longer than any fixed timeout. It can't hang silently — the
      // user can see and dismiss the browser themselves.
      const { createdSessionId, setActive: ssoSetActive, signIn: ssoSignIn } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: ExpoLinking.createURL("/"),
      });
      const sessionId = createdSessionId ?? (ssoSignIn?.createdSessionId as string | null | undefined);
      if (sessionId && ssoSetActive) {
        await withTimeout(ssoSetActive({ session: sessionId }), 20000);
        void logLogin("google");
        router.replace("/(tabs)/dashboard" as any);
      } else {
        setError("Google sign-in didn't complete — please try again.");
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const clerkMsg = (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]?.longMessage
        ?? (e?.errors as Array<{ message?: string }>)?.[0]?.message;
      setError(clerkMsg ?? (e?.message as string) ?? "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  const handleApple = useCallback(async () => {
    setAppleLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken } = credential;
      if (!identityToken) {
        setError("Apple sign-in failed — no identity token received.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await withTimeout(
        signIn.create({ strategy: "oauth_token_apple", token: identityToken }),
        20000,
      ) as any;
      if (result.status === "complete") {
        const { error: finalizeErr } = await withTimeout(signIn.finalize(), 20000) as any;
        if (finalizeErr) {
          setError(clerkErrorMessage(finalizeErr, "Couldn't complete Apple sign-in — please try again."));
          return;
        }
        void logLogin("apple");
        router.replace("/(tabs)/dashboard" as any);
      } else if (result.status === "needs_transfer") {
        // No Clerk account yet — transfer to sign-up path
        const signUpResult = await withTimeout(
          signUp.create({ transfer: true }),
          20000,
        ) as any;
        if (signUpResult.status === "complete") {
          const { error: finalizeErr } = await withTimeout(signUp.finalize(), 20000) as any;
          if (finalizeErr) {
            setError(clerkErrorMessage(finalizeErr, "Couldn't complete Apple sign-in — please try again."));
            return;
          }
          void logLogin("apple");
          router.replace("/(tabs)/dashboard" as any);
        } else {
          setError("Apple sign-in didn't complete — please try again.");
        }
      } else {
        setError("Apple sign-in didn't complete — please try again.");
      }
    } catch (err: unknown) {
      // User cancelled the native Apple prompt — don't show an error
      if ((err as Record<string, unknown>)?.code === "ERR_REQUEST_CANCELED") return;
      const e = err as Record<string, unknown>;
      const clerkMsg = (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]?.longMessage
        ?? (e?.errors as Array<{ message?: string }>)?.[0]?.message;
      setError(clerkMsg ?? (e?.message as string) ?? "Apple sign-in failed.");
    } finally {
      setAppleLoading(false);
    }
  }, [signIn, signUp]);

  if (needsMFA) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.title}>Check your email</Text>
            <Text style={s.subtitle}>We sent a verification code to {email}</Text>
            <Text style={s.label}>Verification code</Text>
            <TextInput
              style={s.input}
              value={verifyCode}
              onChangeText={setVerifyCode}
              placeholder="Enter code"
              placeholderTextColor={T.textDim}
              keyboardType="number-pad"
              autoFocus
            />
            {error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity style={s.primaryBtn} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await withTimeout(signIn?.mfa.sendEmailCode(), 20000);
                } catch (err: unknown) {
                  const e = err as Record<string, unknown>;
                  const msg = (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]?.longMessage
                    ?? (e?.errors as Array<{ message?: string }>)?.[0]?.message
                    ?? (e?.message as string)
                    ?? "Could not resend code — please try again.";
                  setError(msg);
                }
              }}
              style={s.link}
            >
              <Text style={s.linkText}>Resend code</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.logoWrap}>
            <Image source={require("@/assets/images/logo.gif")} style={s.logo} resizeMode="contain" />
          </View>

          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to continue your training</Text>

          {Platform.OS === "ios" && (
            appleLoading
              ? <View style={s.appleBtnLoading}><ActivityIndicator color="#fff" /></View>
              : <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={14}
                  style={s.appleBtn}
                  onPress={handleApple}
                />
          )}

          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogle}
            disabled={loading || googleLoading || appleLoading}
            activeOpacity={0.85}
          >
            {googleLoading
              ? <ActivityIndicator color={T.text} />
              : <><Text style={s.googleIcon}>G</Text><Text style={s.googleText}>Continue with Google</Text></>
            }
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={T.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Text style={s.label}>Password</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, s.inputWithToggle]}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={T.textDim}
              secureTextEntry={!showPassword}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              activeOpacity={0.7}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              {showPassword
                ? <EyeOff size={18} color={T.textMuted} />
                : <Eye size={18} color={T.textMuted} />}
            </TouchableOpacity>
          </View>

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryBtn, (!email || !password) && { opacity: 0.5 }]}
            onPress={handleSignIn}
            disabled={loading || googleLoading || appleLoading || !email || !password}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Sign in</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password" as never)}
            style={s.forgotBtn}
            activeOpacity={0.7}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-up" as never)} activeOpacity={0.7}>
              <Text style={s.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 28, gap: 12 },
  logoWrap: { alignItems: "center", marginBottom: 8 },
  logo: { width: 220, height: 88 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text, textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", marginBottom: 8 },
  appleBtn: { height: 52 },
  appleBtnLoading: { height: 52, backgroundColor: "#000", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 14,
  },
  googleIcon: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  googleText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.border },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: T.text,
  },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.red, textAlign: "center" },
  inputRow: { position: "relative" },
  inputWithToggle: { paddingRight: 46 },
  eyeBtn: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 },
  primaryBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  btnGrad: { height: 52, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  link: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  forgotBtn: { alignItems: "center", paddingVertical: 4 },
  forgotText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.textMuted },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
});
