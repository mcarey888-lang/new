import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  async function handleEmailSignIn() {
    setError(null);
    try {
      const { error: signInError } = await signIn.password({ emailAddress: email, password });
      if (signInError) {
        setError(signInError.message ?? "Sign-in failed. Check your email and password.");
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Sign-in could not be completed.");
          return;
        }
        router.replace("/");
      } else if (signIn.status === "needs_second_factor") {
        await signIn.mfa.sendEmailCode();
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Sign-in failed. Please try again.";
      setError(msg);
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      await signIn.mfa.verifyEmailCode({ code: verifyCode });
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Sign-in could not be completed.");
          return;
        }
        router.replace("/");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Verification failed. Please try again.";
      setError(msg);
    }
  }

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: "summit-ready" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err: any) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  const isLoading = fetchStatus === "fetching" || googleLoading;

  if (signIn.status === "needs_second_factor") {
    return (
      <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
            <Text style={s.title}>Check your email</Text>
            <Text style={s.subtitle}>We sent a verification code to {email}</Text>
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
            <TouchableOpacity style={s.primaryBtn} onPress={handleVerify} disabled={isLoading} activeOpacity={0.85}>
              <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signIn.mfa.sendEmailCode()} style={s.link}>
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

          <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={isLoading} activeOpacity={0.85}>
            {googleLoading
              ? <ActivityIndicator color={T.text} />
              : <>
                  <Text style={s.googleIcon}>G</Text>
                  <Text style={s.googleText}>Continue with Google</Text>
                </>
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
            placeholder="Your password"
            placeholderTextColor={T.textDim}
            secureTextEntry
          />

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryBtn, (!email || !password) && { opacity: 0.5 }]}
            onPress={handleEmailSignIn}
            disabled={isLoading || !email || !password}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
              {fetchStatus === "fetching"
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Sign in</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)} style={s.forgotBtn} activeOpacity={0.7}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-up" as any)} activeOpacity={0.7}>
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
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    paddingVertical: 14,
  },
  googleIcon: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  googleText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: T.text },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.border },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: T.text,
  },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#FF4444", textAlign: "center" },
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
