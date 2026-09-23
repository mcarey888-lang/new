/**
 * The four pillars, and the sheet that opens one.
 *
 * Composition from `summitready-readiness-mockup.html`: a two-column grid of
 * compact bars (the gauge is the only circle on the screen), and a bottom sheet
 * that explains the pillar in the design's four parts.
 *
 * Every figure and every sentence about the user is Readiness 2.0's. The only
 * authored copy is the fixed "what this measures" line, which is the same for
 * everyone and states nothing about anybody. Where production has no per-pillar
 * advice, the sheet says so rather than inventing one.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChevronRight, Heart, Info, Mountain, TrendingUp, Zap } from "lucide-react-native";
import { BASECAMP } from "@/constants/tokens";
import { T } from "@/constants/theme";
import {
  SRButton, SREmptyState, SRPanel, SRProgress, SRSectionHeader, SRSheet, SRStatusPill, SRSubPanel,
} from "@/components/ui";
import { formatScore, type PillarDetail } from "@/utils/readinessPresentation";

const PILLAR_ICON: Record<string, typeof Heart> = {
  endurance: Heart,
  elevationCapacity: TrendingUp,
  consistency: Zap,
  mountainExperience: Mountain,
};

/** Gap tone. Warning, not alarm — a gap is where the work is, not a failure. */
const GAP = T.orange;

function toneFor(p: PillarDetail): string {
  if (p.missing) return BASECAMP.textDim;
  return p.isGap ? GAP : BASECAMP.accent;
}

export function PillarGrid({
  pillars, onOpen, onHowItWorks,
}: {
  pillars: PillarDetail[];
  onOpen: (p: PillarDetail) => void;
  onHowItWorks?: () => void;
}) {
  return (
    <View style={styles.section}>
      <SRSectionHeader
        title="The four pillars"
        action={onHowItWorks ? "How it works" : undefined}
        onAction={onHowItWorks}
        style={{ marginHorizontal: BASECAMP.gutter }}
      />
      <View style={styles.grid}>
        {pillars.map(p => <PillarCard key={p.key} pillar={p} onPress={() => onOpen(p)} />)}
      </View>
    </View>
  );
}

function PillarCard({ pillar, onPress }: { pillar: PillarDetail; onPress: () => void }) {
  const Icon = PILLAR_ICON[pillar.key] ?? Heart;
  const tone = toneFor(pillar);
  return (
    <SRSubPanel
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={
        `${pillar.label}: ${pillar.missing ? "not yet scored" : `${Math.round(pillar.score!)} out of 100`}`
        + (pillar.isGap ? ", your largest gap" : "")
      }
    >
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Icon size={15} color={tone} />
          <Text style={styles.cardName} numberOfLines={1}>{pillar.label}</Text>
          <Text style={[styles.cardValue, { color: pillar.missing ? BASECAMP.textDim : BASECAMP.text }]}>
            {formatScore(pillar.score)}
            {!pillar.missing && <Text style={styles.cardPct}>%</Text>}
          </Text>
          <ChevronRight size={12} color={BASECAMP.textFaint} />
        </View>

        <SRProgress
          value={pillar.score ?? 0}
          tone={tone}
          height={6}
          style={styles.cardBar}
          accessibilityLabel={`${pillar.label} score`}
        />

        <View style={styles.cardFoot}>
          {pillar.isGap ? <SRStatusPill label="Gap" tone={GAP} /> : null}
          {!pillar.isGap && pillar.isStrength ? <SRStatusPill label="Strength" tone={BASECAMP.accent} /> : null}
          {!pillar.isGap && !pillar.isStrength && pillar.missing
            ? <Text style={styles.cardNote} numberOfLines={1}>No evidence yet</Text> : null}
        </View>
      </View>
    </SRSubPanel>
  );
}

/* ── The detail sheet ──────────────────────────────────────────────────── */

export function PillarSheet({
  pillar, visible, onClose, onViewPlan, nextActionLabel,
}: {
  pillar: PillarDetail | null;
  visible: boolean;
  onClose: () => void;
  onViewPlan: () => void;
  /** The engine's next action, shown only when it targets this pillar. */
  nextActionLabel?: string | null;
}) {
  return (
    <SRSheet visible={visible && Boolean(pillar)} onClose={onClose} accessibilityLabel={pillar?.label}>
      {pillar ? <PillarSheetBody
        pillar={pillar}
        onClose={onClose}
        onViewPlan={onViewPlan}
        nextActionLabel={nextActionLabel}
      /> : null}
    </SRSheet>
  );
}

function PillarSheetBody({
  pillar, onClose, onViewPlan, nextActionLabel,
}: {
  pillar: PillarDetail;
  onClose: () => void;
  onViewPlan: () => void;
  nextActionLabel?: string | null;
}) {
  const Icon = PILLAR_ICON[pillar.key] ?? Heart;
  const tone = toneFor(pillar);

  return (
    <View>
      <View style={styles.sheetHead}>
        <View style={styles.sheetHeadText}>
          <View style={styles.sheetTitleRow}>
            <Icon size={17} color={tone} />
            <Text style={styles.sheetTitle} numberOfLines={2}>{pillar.label}</Text>
            {pillar.isGap ? <SRStatusPill label="Gap" tone={GAP} /> : null}
          </View>
          <Text style={styles.sheetMeasures}>{pillar.measures}</Text>
        </View>
        <Text style={[styles.sheetScore, { color: pillar.missing ? BASECAMP.textDim : tone }]}>
          {formatScore(pillar.score)}
          {!pillar.missing && <Text style={styles.sheetScorePct}>%</Text>}
        </Text>
      </View>

      <SRProgress value={pillar.score ?? 0} tone={tone} height={6} style={{ marginTop: 11 }} />

      <Text style={styles.sheetLabel}>
        {pillar.missing ? "WHY IT IS NOT SCORED" : `WHY IT IS ${Math.round(pillar.score!)}%`}
      </Text>
      {pillar.explanation ? (
        <Text style={styles.sheetBody}>{pillar.explanation}</Text>
      ) : (
        <Text style={styles.sheetBody}>
          Readiness has not scored this pillar yet. It needs eligible activity before it can say
          anything about it.
        </Text>
      )}

      <Text style={styles.sheetLabel}>EVIDENCE USED</Text>
      <SRSubPanel style={styles.sheetEvidence}>
        <View style={styles.sheetEvidenceRow}>
          <Text style={styles.sheetEvidenceKey}>Activities counted</Text>
          <Text style={styles.sheetEvidenceValue}>
            {pillar.evidenceCount === 0 ? "None yet" : String(pillar.evidenceCount)}
          </Text>
        </View>
      </SRSubPanel>

      <Text style={styles.sheetLabel}>WHAT WILL MOVE THIS</Text>
      {pillar.isFocus && nextActionLabel ? (
        <SRPanel radius={14} style={{ marginTop: 8 }}>
          <View style={styles.improveRow}>
            <Zap size={15} color={BASECAMP.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.improveHead}>{nextActionLabel}</Text>
              <Text style={styles.improveBody}>
                Readiness picked this as your next best action because it targets this pillar.
              </Text>
            </View>
          </View>
        </SRPanel>
      ) : (
        <SREmptyState
          compact
          title="No specific recommendation for this pillar"
          body="Readiness recommends one next action at a time, and right now it is not this pillar. Your plan is the place to work on it."
        />
      )}

      <View style={styles.sheetActions}>
        <SRButton compact variant="secondary" label="View plan" onPress={onViewPlan} style={{ flex: 1 }} />
        <SRButton compact label="Close" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  grid: {
    marginTop: 10, paddingHorizontal: BASECAMP.gutter,
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  /* Two per row at every width; the gap is subtracted once. */
  card: { flexBasis: "48%", flexGrow: 1, minWidth: 0 },
  cardInner: { padding: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: {
    flex: 1, minWidth: 0,
    fontSize: 12.5, lineHeight: 16, fontFamily: "Inter_600SemiBold", color: BASECAMP.text,
  },
  cardValue: { fontSize: 15, lineHeight: 18, fontFamily: "Inter_700Bold" },
  cardPct: { fontSize: 10, color: BASECAMP.textDim },
  cardBar: { marginTop: 9 },
  cardFoot: { marginTop: 8, minHeight: 18, justifyContent: "center" },
  cardNote: { fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sheetHeadText: { flex: 1, minWidth: 0 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sheetTitle: {
    fontSize: 19, lineHeight: 24, fontFamily: "Inter_700Bold",
    color: BASECAMP.text, letterSpacing: -0.4, flexShrink: 1,
  },
  sheetMeasures: {
    marginTop: 7, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },
  sheetScore: { fontSize: 30, lineHeight: 32, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  sheetScorePct: { fontSize: 14, color: BASECAMP.textDim },

  sheetLabel: {
    marginTop: 18, fontSize: 10, lineHeight: 13, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.8, color: BASECAMP.textMuted,
  },
  sheetBody: {
    marginTop: 7, fontSize: 12.5, lineHeight: 18,
    fontFamily: "Inter_400Regular", color: BASECAMP.textStrong,
  },
  sheetEvidence: { marginTop: 8 },
  sheetEvidenceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 12, padding: 11,
  },
  sheetEvidenceKey: { fontSize: 11.5, lineHeight: 15, fontFamily: "Inter_600SemiBold", color: BASECAMP.text },
  sheetEvidenceValue: { fontSize: 11.5, lineHeight: 15, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },

  improveRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12 },
  improveHead: { fontSize: 13, lineHeight: 17, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  improveBody: {
    marginTop: 4, fontSize: 11.5, lineHeight: 16,
    fontFamily: "Inter_400Regular", color: BASECAMP.textDim,
  },

  sheetActions: { flexDirection: "row", gap: 8, marginTop: 18 },
});
