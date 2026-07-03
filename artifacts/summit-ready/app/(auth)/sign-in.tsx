import { useSignIn, useSSO } from "@clerk/expo";
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

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signIn } = useSignIn() as any;
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsMFA, setNeedsMFA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  async function handleSignIn() {
    if (!signIn) {
      setError("Authentication is not ready yet — please try again in a moment.");
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
      const { error: signInErr } = await signIn.password({ emailAddress: email, password });
      if (signInErr) {
        setError(signInErr.message ?? "Sign-in failed — please try again.");
        return;
      }
      if (signIn.status === "complete") {
        const { error } = await signIn.finalize();
        if (!error) router.replace("/(tabs)/dashboard" as any);
      } else if (signIn.status === "needs_second_factor") {
        await signIn.mfa.sendEmailCode();
        setNeedsMFA(true);
      } else {
        setError("Sign-in failed — please try again.");
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const clerkMsg =
        (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]
          ?.longMessage ??
        (e?.errors as Array<{ longMessage?: string; message?: string }>)?.[0]
          ?.message;
      const fallback = (e?.message as string) ?? JSON.stringify(err);
      setError(clerkMsg ?? fallback ?? "Sign-in failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signIn) return;
    setLoading(true);
    setError(null);
    try {
      await signIn.mfa.verifyEmailCode({ code: verifyCode });
      if (signIn.status === "complete") {
        const { error } = await signIn.finalize();
        if (!error) router.replace("/(tabs)/dashboard" as any);
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
      const { createdSessionId, setActive: ssoSetActive, signIn: ssoSignIn } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      const sessionId = createdSessionId ?? (ssoSignIn?.createdSessionId as string | null | undefined);
      if (sessionId && ssoSetActive) {
        await ssoSetActive({ session: sessionId });
        router.replace("/(tabs)/dashboard" as any);
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
            <TouchableOpacity onPress={() => signIn?.mfa.sendEmailCode()} style={s.link}>
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
            disabled={loading || googleLoading || !email || !password}
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
