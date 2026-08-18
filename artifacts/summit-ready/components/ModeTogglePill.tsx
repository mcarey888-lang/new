import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { ArrowDownToLine, Mountain, Route, AlertCircle } from "lucide-react-native";

const TRAINING_COLOR    = T.green;
const EXPEDITION_COLOR  = T.blue;

export function ModeTogglePill() {
  const insets  = useSafeAreaInsets();
  const isIOS   = Platform.OS === "ios";
  const {
    shellMode,
    setShellMode,
    getExpeditionAscentMigrationSummary,
    importExpeditionAscents
  } = useApp();

  const [migrationSummary, setMigrationSummary] = useState<ReturnType<typeof getExpeditionAscentMigrationSummary>>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const top = insets.top + (Platform.OS === "web" ? 8 : 4);

  async function performSwitch(mode: "training" | "expedition") {
    setIsSwitching(true);
    try {
      await setShellMode(mode);
      if (mode === "expedition") {
        router.replace("/(expedition)/base-camp" as any);
      } else {
        router.replace("/(tabs)/dashboard" as any);
      }
    } finally {
      setIsSwitching(false);
    }
  }

  async function switchTo(mode: "training" | "expedition") {
    if (mode === shellMode || isSwitching || isMigrating) return;

    if (mode === "training" && shellMode === "expedition") {
      const summary = getExpeditionAscentMigrationSummary();
      if (summary) {
        setMigrationSummary(summary);
        setMigrationError(null);
        return;
      }
    }

    await performSwitch(mode);
  }

  async function handleImport() {
    if (!migrationSummary || isMigrating || isSwitching) return;
    setIsMigrating(true);
    setMigrationError(null);
    try {
      await importExpeditionAscents(migrationSummary.expeditionId);
      await performSwitch("training");
      setMigrationSummary(null);
    } catch (err) {
      setMigrationError("Failed to import ascents. Please try again.");
    } finally {
      setIsMigrating(false);
    }
  }

  async function handleNotNow() {
    if (isMigrating || isSwitching) return;
    await performSwitch("training");
    setMigrationSummary(null);
  }

  const pill = (
    <View style={s.pill}>
      {/* Training segment */}
      <TouchableOpacity
        onPress={() => switchTo("training")}
        activeOpacity={0.75}
        disabled={isSwitching || isMigrating}
        style={[
          s.segment,
          shellMode === "training" && { backgroundColor: TRAINING_COLOR },
        ]}
      >
        <Text style={[
          s.label,
          shellMode === "training"
            ? s.labelActive
            : { color: "rgba(255,255,255,0.45)" },
        ]}>
          Training
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={s.divider} />

      {/* Expeditions segment */}
      <TouchableOpacity
        onPress={() => switchTo("expedition")}
        activeOpacity={0.75}
        disabled={isSwitching || isMigrating}
        style={[
          s.segment,
          shellMode === "expedition" && { backgroundColor: EXPEDITION_COLOR },
        ]}
      >
        <Text style={[
          s.label,
          shellMode === "expedition"
            ? s.labelActive
            : { color: "rgba(255,255,255,0.45)" },
        ]}>
          Expeditions
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <View
        style={[s.wrapper, { top }]}
        pointerEvents="box-none"
      >
        {isIOS ? (
          <BlurView intensity={55} tint="dark" style={s.blurWrap}>
            {pill}
          </BlurView>
        ) : (
          <View style={s.plainBg}>
            {pill}
          </View>
        )}
      </View>

      <Modal
        visible={!!migrationSummary}
        transparent
        animationType="fade"
        onRequestClose={handleNotNow}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={s.iconCircle}>
                <ArrowDownToLine size={24} color={T.green} />
              </View>
              <Text style={s.modalTitle}>Import Ascents</Text>
            </View>

            <Text style={s.modalText}>
              You logged <Text style={s.boldText}>{migrationSummary?.ascentCount}</Text> ascents on <Text style={s.boldText}>{migrationSummary?.expeditionName}</Text>. Would you like to bring this progress into your Training history?
            </Text>

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Mountain size={16} color={T.textMuted} />
                <View style={s.statTextWrap}>
                  <Text style={s.statValue}>{migrationSummary?.totalElevationM.toLocaleString()} m</Text>
                  <Text style={s.statLabel}>Elevation</Text>
                </View>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Route size={16} color={T.textMuted} />
                <View style={s.statTextWrap}>
                  <Text style={s.statValue}>{migrationSummary?.totalDistanceKm.toFixed(1)} km</Text>
                  <Text style={s.statLabel}>Distance</Text>
                </View>
              </View>
            </View>

            {migrationError && (
              <View style={s.errorBox}>
                <AlertCircle size={16} color={T.red} />
                <Text style={s.errorText}>{migrationError}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.primaryButton}
                onPress={handleImport}
                disabled={isMigrating}
                activeOpacity={0.8}
              >
                {isMigrating ? (
                  <ActivityIndicator color={T.bg} />
                ) : (
                  <Text style={s.primaryButtonText}>Import and continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.secondaryButton}
                onPress={handleNotNow}
                disabled={isMigrating}
                activeOpacity={0.8}
              >
                <Text style={s.secondaryButtonText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
    pointerEvents: "box-none",
  } as any,
  blurWrap: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  plainBg: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(12,20,36,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 0,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  labelActive: {
    color: "#fff",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: T.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: T.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.greenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: T.text,
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  boldText: {
    fontFamily: "Inter_600SemiBold",
    color: T.text,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  statTextWrap: {
    alignItems: "flex-start",
  },
  statDivider: {
    width: 1,
    backgroundColor: T.border,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: T.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.redDim,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.red,
    lineHeight: 18,
  },
  modalActions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: T.green,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: T.bg,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
  },
});
