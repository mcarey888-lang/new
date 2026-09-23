import { ArrowLeft, Info } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ElevationBankCard } from "@/components/ElevationBankCard";
import { T } from "@/constants/theme";

export default function ElevationHistoryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={T.bgGrad} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === "web" ? 20 : insets.top + 12,
            paddingBottom: Platform.OS === "web" ? 32 : insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          testID="elevation-history-back"
        >
          <ArrowLeft size={18} color={T.textMuted} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>PRIVATE ACTIVITY RECORD</Text>
        <Text style={styles.title}>Elevation History</Text>
        <Text style={styles.subtitle}>
          One physical activity, one effective personal credit. Corrections
          remain visible without rewriting the original record.
        </Text>

        <ElevationBankCard expanded emphasis />

        <View style={styles.note}>
          <Info size={16} color={T.blue} />
          <Text style={styles.noteText}>
            Only qualified recorded outdoor ascent appears in this ledger.
            Manual, indoor, and unavailable or untrusted evidence remain in
            your existing history but do not count toward Elevation Bank
            totals.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 28, alignSelf: "flex-start" },
  backText: { color: T.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" },
  eyebrow: { color: T.green, fontSize: 10, letterSpacing: 1.2, fontFamily: "Inter_700Bold" },
  title: { color: T.text, fontSize: 30, lineHeight: 36, fontFamily: "Inter_700Bold", marginTop: 4 },
  subtitle: { color: T.textMuted, fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: 8, marginBottom: 22 },
  note: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, backgroundColor: T.blueDim, borderWidth: 1, borderColor: T.blue + "30" },
  noteText: { flex: 1, color: T.textMuted, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
});