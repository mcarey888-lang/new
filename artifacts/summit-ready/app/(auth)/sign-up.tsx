import { useAuth, useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Eye, EyeOff } from "lucide-react-native";
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

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { isLoaded } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signUp, setActive } = useSignUp() as any;
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  useEffect(() => {
    if (isLoaded) {
      setClerkTimedOut(false);
      return;
    }
    const t = setTimeout(() => setClerkTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  async function handleSignUp() {
    if (!isLoaded || !signUp) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setNeedsVerification(true);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const clerkMsg =
        (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]
          ?.longMessage ??
        (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]
          ?.message;
      const fallback = (e?.message as string) ?? JSON.stringify(err);
      setError(clerkMsg ?? fallback ?? "Sign-up failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.attemptEmailAddressVerification({ code: verifyCode });
      if (signUp.status === "complete") {
        const { error } = await signUp.finalize();
        if (!error) router.replace("/");
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
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      setError((e?.message as string) ?? "Google sign-up failed.");
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
              disabled={loading || !verifyCode}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & get started</Text>}
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
            disabled={loading || googleLoading}
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
              placeholder="At least 8 characters"
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

          {!isLoaded && !clerkTimedOut && (
            <View style={s.connectingRow}>
              <ActivityIndicator size="small" color={T.textMuted} style={{ marginRight: 8 }} />
              <Text style={s.connectingText}>Connecting to auth server…</Text>
            </View>
          )}

          {clerkTimedOut && (
            <Text style={s.error}>
              Can't reach the authentication server. Check your internet connection and restart the app.
            </Text>
          )}

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryBtn, (!email || !password || !isLoaded) && { opacity: 0.5 }]}
            onPress={handleSignUp}
            disabled={loading || googleLoading || !email || !password || !isLoaded}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
              {loading
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
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in" as never)} activeOpacity={0.7}>
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
  connectingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  connectingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.red, textAlign: "center" },
  inputRow: { position: "relative" },
  inputWithToggle: { paddingRight: 46 },
  eyeBtn: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 },
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
