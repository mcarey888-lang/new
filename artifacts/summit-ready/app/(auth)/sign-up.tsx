import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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

WebBrowser.maybeCompleteAuthSession();

/** Rejects after `ms` milliseconds with a user-facing timeout message. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Please check your connection and try again.")), ms)
    ),
  ]);
}

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signUp, setActive, isLoaded: clerkLoaded } = useSignUp() as any;
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  async function handleEmailSignUp() {
    if (!clerkLoaded || typeof signUp?.create !== "function") {
      setError("Authentication service is still loading — please wait a moment.");
      return;
    }
    setEmailLoading(true);
    setError(null);
    try {
      await withTimeout(
        signUp.create({ emailAddress: email, password }),
        15000
      );
      await withTimeout(
        signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
        10000
      );
      setNeedsVerification(true);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.message ??
        "Sign-up failed. Please try again.";
      setError(msg);
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUp) return;
    setEmailLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attempt: any = await withTimeout(
        signUp.attemptEmailAddressVerification({ code: verifyCode }),
        15000
      );
      const status = attempt?.status ?? signUp.status;
      if (status === "complete") {
        const sessionId = attempt?.createdSessionId ?? signUp.createdSessionId;
        await withTimeout(setActive({ session: sessionId }), 10000);
        router.replace("/");
      } else {
        setError("Verification failed. Please check the code and try again.");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Verification failed.";
      setError(msg);
    } finally {
      setEmailLoading(false);
    }
  }

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await withTimeout(
        startSSOFlow({
          strategy: "oauth_google",
          redirectUrl: AuthSession.makeRedirectUri({ scheme: "summit-ready" }),
        }),
        30000
      );
      if (createdSessionId && ssoSetActive) {
        await withTimeout(ssoSetActive({ session: createdSessionId }), 10000);
        router.replace("/");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Google sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  if (needsVerification) {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.logoWrap}>
              <Image source={require("@/assets/images/logo.gif")} style={s.logo} resizeMode="contain" />
            </View>
            <Text style={s.title}>Verify your email</Text>
            <Text style={s.subtitle}>We sent a code to {email}</Text>
            <Text style={s.label}>Verification code</Text>
            <TextInput
              style={s.input}
              value={verifyCode}
              onChangeText={setVerifyCode}
              placeholder="Enter 6-digit code"
              placeholderTextColor={T.textDim}
              keyboardType="number-pad"
              autoFocus
            />
            {error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity
              style={[s.primaryBtn, !verifyCode && { opacity: 0.5 }]}
              onPress={handleVerify}
              disabled={emailLoading || !verifyCode}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                {emailLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & get started</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => signUp?.prepareEmailAddressVerification({ strategy: "email_code" })}
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

          <Text style={s.title}>Create your account</Text>
          <Text style={s.subtitle}>Join SummitReady and start your mountain journey</Text>

          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogle}
            disabled={emailLoading || googleLoading}
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
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={T.textDim}
            secureTextEntry
          />

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryBtn, (!clerkLoaded || !email || !password) && { opacity: 0.5 }]}
            onPress={handleEmailSignUp}
            disabled={!clerkLoaded || emailLoading || googleLoading || !email || !password}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
              {!clerkLoaded
                ? <ActivityIndicator color="#fff" />
                : emailLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Create account</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.terms}>
            By creating an account you agree to our{" "}
            <Text style={s.termsLink} onPress={() => Linking.openURL("https://summitready.uk/terms")}>
              Terms of Service
            </Text>
            {" "}and{" "}
            <Text style={s.termsLink} onPress={() => Linking.openURL("https://summitready.uk/privacy")}>
              Privacy Policy
            </Text>.
          </Text>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in" as any)} activeOpacity={0.7}>
              <Text style={s.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>

          <View nativeID="clerk-captcha" />
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
  error: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#FF4444", textAlign: "center" },
  primaryBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  btnGrad: { height: 52, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  link: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  terms: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textDim, textAlign: "center", lineHeight: 16 },
  termsLink: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.green, textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
});
