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
import { BASECAMP, SP, TYPE } from "@/constants/tokens";
import { SREyebrow, SRScreenHeader } from "@/components/ui";

export default function ElevationHistoryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
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
        <SRScreenHeader
          title=""
          onBack={() => router.back()}
          style={styles.back}
          backTestID="elevation-history-back"
        />
        <SREyebrow tone={BASECAMP.accent}>PRIVATE ACTIVITY RECORD</SREyebrow>
        <Text style={styles.title}>Elevation History</Text>
        <Text style={styles.subtitle}>
          One physical activity, one effective personal credit. Corrections
          remain visible without rewriting the original record.
        </Text>

        <ElevationBankCard expanded emphasis />

        <View style={styles.note}>
          <Info size={16} color={BASECAMP.accent} />
          <Text style={styles.noteText}>
            Only qualified recorded outdoor ascent appears in this ledger.
            Manual, indoor, and unavailable or untrusted evidence remain in
            your existing history but do not count toward Elevation Bank
            totals.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BASECAMP.ink },
  content: { paddingHorizontal: BASECAMP.gutter },
  back: { marginBottom: SP.lg, marginHorizontal: -BASECAMP.gutter },
  title: { marginTop: 5, ...TYPE.hero, fontSize: 29, lineHeight: 33, color: BASECAMP.text },
  subtitle: { marginTop: 8, marginBottom: 20, ...TYPE.small, fontSize: 13, lineHeight: 19, color: BASECAMP.textMuted },
  note: {
    marginTop: SP.lg, flexDirection: "row", gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  noteText: { flex: 1, ...TYPE.caption, fontSize: 12, lineHeight: 18, color: BASECAMP.textMuted },
});