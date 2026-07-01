import { useSignIn } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, setActive } = useSignIn();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestReset() {
    if (!email) { setError("Please enter your email address."); return; }
    setError(null);
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (signIn as any).create({ strategy: "reset_password_email_code", identifier: email });
      setStep("reset");
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Could not send reset email. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!code) { setError("Please enter the code from your email."); return; }
    if (!newPassword) { setError("Please enter a new password."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(null);
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attempt: any = await (signIn as any).attemptFirstFactor({ strategy: "reset_password_email_code", code, password: newPassword });
      if (attempt?.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Reset failed. Check your code and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={s.back} activeOpacity={0.7}>
            <Text style={s.backText}>← Back to sign in</Text>
          </TouchableOpacity>

          <Text style={s.title}>{step === "email" ? "Reset password" : "Set new password"}</Text>
          <Text style={s.subtitle}>
            {step === "email"
              ? "Enter your email and we'll send you a reset code."
              : `We sent a code to ${email}. Enter it below along with your new password.`}
          </Text>

          {step === "email" ? (
            <>
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
                autoFocus
              />
              {error && <Text style={s.error}>{error}</Text>}
              <TouchableOpacity
                style={[s.primaryBtn, !email && { opacity: 0.5 }]}
                onPress={handleRequestReset}
                disabled={loading || !email}
                activeOpacity={0.85}
              >
                <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send reset code</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.label}>Reset code</Text>
              <TextInput
                style={s.input}
                value={code}
                onChangeText={setCode}
                placeholder="6-digit code"
                placeholderTextColor={T.textDim}
                keyboardType="number-pad"
                autoFocus
              />
              <Text style={s.label}>New password</Text>
              <TextInput
                style={s.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={T.textDim}
                secureTextEntry
              />
              <Text style={s.label}>Confirm password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={T.textDim}
                secureTextEntry
              />
              {error && <Text style={s.error}>{error}</Text>}
              <TouchableOpacity
                style={[s.primaryBtn, (!code || !newPassword || !confirmPassword) && { opacity: 0.5 }]}
                onPress={handleResetPassword}
                disabled={loading || !code || !newPassword || !confirmPassword}
                activeOpacity={0.85}
              >
                <LinearGradient colors={["#3ECF75", "#2AB860"]} style={s.btnGrad}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Reset password</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRequestReset} style={s.link} disabled={loading} activeOpacity={0.7}>
                <Text style={s.linkText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 28, gap: 12 },
  back: { marginBottom: 8 },
  backText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: T.textMuted, marginBottom: 8 },
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
});
