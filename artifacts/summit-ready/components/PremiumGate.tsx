import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSubscription } from "@/lib/revenuecat";
import { T } from "@/constants/theme";

interface PremiumGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

export function PremiumGate({ feature, description, children }: PremiumGateProps) {
  const { isSubscribed, isLoading } = useSubscription();

  if (isLoading || isSubscribed) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[T.purpleDim, "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.lockIconWrap}>
        <Feather name="lock" size={20} color={T.purple} />
      </View>
      <Text style={styles.featureText}>{feature}</Text>
      {description && <Text style={styles.descText}>{description}</Text>}
      <TouchableOpacity
        onPress={() => router.push("/paywall")}
        style={styles.upgradeBtn}
        activeOpacity={0.85}
      >
        <LinearGradient colors={["#3ECF75", "#2AB860"]} style={styles.upgradeBtnGrad}>
          <Feather name="zap" size={13} color="#fff" />
          <Text style={styles.upgradeBtnText}>Unlock with Pro</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

interface PremiumBadgeProps {
  onPress?: () => void;
}

export function PremiumBadge({ onPress }: PremiumBadgeProps) {
  const { isSubscribed } = useSubscription();

  if (isSubscribed) {
    return (
      <View style={styles.proBadge}>
        <Feather name="zap" size={10} color={T.green} />
        <Text style={styles.proBadgeText}>PRO</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.push("/paywall"))}
      style={styles.freeBadge}
      activeOpacity={0.8}
    >
      <Feather name="lock" size={10} color={T.purple} />
      <Text style={styles.freeBadgeText}>FREE</Text>
    </TouchableOpacity>
  );
}

interface LockedFeatureRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

export function LockedFeatureRow({ icon, label }: LockedFeatureRowProps) {
  return (
    <TouchableOpacity
      onPress={() => router.push("/paywall")}
      activeOpacity={0.7}
      style={styles.lockedRow}
    >
      <View style={styles.lockedIconWrap}>
        <Feather name={icon} size={15} color={T.textDim} />
      </View>
      <Text style={styles.lockedLabel}>{label}</Text>
      <View style={styles.lockBadge}>
        <Feather name="lock" size={10} color={T.purple} />
        <Text style={styles.lockBadgeText}>PRO</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16, borderWidth: 1, borderColor: T.purple + "30",
    padding: 20, gap: 8, alignItems: "center",
    overflow: "hidden",
  },
  lockIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: T.purpleDim, alignItems: "center", justifyContent: "center",
  },
  featureText: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: T.white, textAlign: "center",
  },
  descText: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center",
  },
  upgradeBtn: { borderRadius: 12, overflow: "hidden", marginTop: 4 },
  upgradeBtnGrad: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  upgradeBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  proBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: T.greenDim, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.green + "40",
  },
  proBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.green },
  freeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: T.purpleDim, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.purple + "40",
  },
  freeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: T.purple },
  lockedRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: 12, paddingHorizontal: 14,
    opacity: 0.65,
  },
  lockedIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center", justifyContent: "center",
  },
  lockedLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },
  lockBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: T.purpleDim, borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  lockBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: T.purple },
});
