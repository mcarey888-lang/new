/**
 * DayStrip — compact editable 7-day calendar strip for the Expedition Dashboard.
 *
 * Renders Mon–Sun columns. Each day shows the session assigned to it (if any)
 * with colour-coded icons and completion state. Sessions can be dragged to a
 * different day via a tap-to-select + tap-to-place interaction.
 *
 * Day assignment priority:
 *   1. Manual override stored in sessionDayOverrides (persisted in AppContext)
 *   2. Auto-assignment from assignSessionsToDays() using summitGoal.availableDays
 *   3. Unassigned (session shown in "unscheduled" row below the strip)
 */
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Activity, Check, Flag, TrendingUp } from "lucide-react-native";

import type { PlanSession } from "@/context/AppContext";
import { T } from "@/constants/theme";
import { assignSessionsToDays, todayDow, DAY_SHORT } from "@/utils/dayAssignment";

// Mon-first display order (0=Sun is last)
const DISPLAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];

interface DayStripProps {
  weekNum: number;
  sessions: PlanSession[];
  completedPlanSessions: Record<string, boolean>;
  availableDays?: number[];
  sessionDayOverrides: Record<string, number>;
  onReassign: (sessionIdx: number, newDow: number) => void;
}

function tc(type: string): string {
  if (type === "hill") return T.green;
  if (type === "bigDay") return T.orange;
  return T.blue;
}

function TypeIcon({ type, size = 12 }: { type: string; size?: number }) {
  const color = tc(type);
  if (type === "hill")   return <TrendingUp size={size} color={color} />;
  if (type === "bigDay") return <Flag size={size} color={color} />;
  return <Activity size={size} color={color} />;
}

export function DayStrip({
  weekNum, sessions, completedPlanSessions,
  availableDays, sessionDayOverrides, onReassign,
}: DayStripProps) {
  const [reassigning, setReassigning] = useState<number | null>(null);
  const today = todayDow();

  // Build effective day→session mapping
  const autoAssigned = assignSessionsToDays(sessions.length, availableDays);
  // Apply manual overrides on top of auto-assignment
  const effective: Array<{ sessionIdx: number; dow: number | null }> = autoAssigned.map(a => {
    const key = `${weekNum}-${a.sessionIdx}`;
    const override = sessionDayOverrides[key];
    return { sessionIdx: a.sessionIdx, dow: override !== undefined ? override : a.dayOfWeek };
  });

  // dow → sessionIdx reverse map (first-come wins for conflicts)
  const dowToSession: Record<number, number> = {};
  for (const { sessionIdx, dow } of effective) {
    if (dow !== null && dowToSession[dow] === undefined) {
      dowToSession[dow] = sessionIdx;
    }
  }

  const unassigned = effective.filter(e => e.dow === null);

  function pickSession(idx: number) {
    setReassigning(prev => (prev === idx ? null : idx));
  }

  function placeOnDay(dow: number) {
    if (reassigning === null) return;
    onReassign(reassigning, dow);
    setReassigning(null);
  }

  const isReassignMode = reassigning !== null;

  return (
    <View style={s.wrap}>
      {/* ── 7-day strip ─────────────────────────────────────────────── */}
      <View style={s.strip}>
        {DISPLAY_ORDER.map(dow => {
          const isToday = dow === today;
          const sIdx = dowToSession[dow];
          const hasSession = sIdx !== undefined;
          const isDone = hasSession && !!completedPlanSessions[`${weekNum}-${sIdx}`];
          const session = hasSession ? sessions[sIdx] : undefined;
          const isSelected = reassigning === sIdx;
          const color = session ? tc(session.type) : T.textDim;

          return (
            <TouchableOpacity
              key={dow}
              style={[s.dayCol, isToday && s.dayColToday]}
              activeOpacity={0.75}
              onPress={() => {
                if (hasSession) {
                  pickSession(sIdx);
                } else if (isReassignMode) {
                  placeOnDay(dow);
                }
              }}
            >
              <Text style={[s.dayLabel, isToday && s.dayLabelToday]}>
                {DAY_SHORT[dow]}
              </Text>

              {hasSession && session ? (
                <View style={[
                  s.sessionDot,
                  {
                    backgroundColor: isDone ? T.greenDim : color + "1A",
                    borderColor: isDone ? T.green + "60"
                      : isSelected ? color + "CC"
                      : color + "40",
                    borderWidth: isSelected ? 2 : 1.5,
                  },
                ]}>
                  {isDone
                    ? <Check size={11} color={T.green} strokeWidth={3} />
                    : <TypeIcon type={session.type} />}
                </View>
              ) : (
                <View style={[
                  s.restDot,
                  isReassignMode && s.restDotTarget,
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Unscheduled sessions ─────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <View style={s.unassignedRow}>
          {unassigned.map(({ sessionIdx }) => {
            const session = sessions[sessionIdx];
            const color = tc(session.type);
            const isDone = !!completedPlanSessions[`${weekNum}-${sessionIdx}`];
            const isSelected = reassigning === sessionIdx;
            return (
              <TouchableOpacity
                key={sessionIdx}
                style={[
                  s.unassignedChip,
                  {
                    borderColor: isDone ? T.green + "50"
                      : isSelected ? color + "90"
                      : color + "35",
                    backgroundColor: isDone ? T.greenDim
                      : isSelected ? color + "15"
                      : T.surface,
                  },
                ]}
                onPress={() => pickSession(sessionIdx)}
                activeOpacity={0.8}
              >
                <TypeIcon type={session.type} size={10} />
                <Text style={[s.unassignedText, { color: isDone ? T.green : color }]} numberOfLines={1}>
                  {session.label}
                </Text>
                <Text style={s.unassignedHint}>
                  {isSelected ? "tap a day →" : "no day set"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Reassign picker ──────────────────────────────────────────── */}
      {isReassignMode && (
        <View style={s.reassignRow}>
          <Text style={s.reassignLabel}>Move to:</Text>
          {DISPLAY_ORDER.map(dow => {
            const occupiedBy = dowToSession[dow];
            const isOccupied = occupiedBy !== undefined && occupiedBy !== reassigning;
            return (
              <TouchableOpacity
                key={dow}
                style={[s.reassignBtn, isOccupied && s.reassignBtnOccupied]}
                onPress={() => !isOccupied && placeOnDay(dow)}
                disabled={isOccupied}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={[s.reassignBtnText, isOccupied && { color: T.textDim }]}>
                  {DAY_SHORT[dow]}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setReassigning(null)}
            style={s.reassignCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.reassignCancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 6 },

  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayCol: {
    flex: 1, alignItems: "center", gap: 5,
    paddingVertical: 6, paddingHorizontal: 2,
    borderRadius: 10,
  },
  dayColToday: { backgroundColor: T.greenDim },
  dayLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.3,
  },
  dayLabelToday: { color: T.green },

  sessionDot: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  restDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: T.border, marginVertical: 12.5,
  },
  restDotTarget: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.green + "50", marginVertical: 10,
  },

  unassignedRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 6, marginBottom: 6,
  },
  unassignedChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5,
    flex: 1, minWidth: 120,
  },
  unassignedText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1,
  },
  unassignedHint: {
    fontSize: 9, fontFamily: "Inter_400Regular", color: T.textDim,
  },

  reassignRow: {
    flexDirection: "row", alignItems: "center",
    flexWrap: "wrap", gap: 5,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 2,
  },
  reassignLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: T.textMuted, marginRight: 2,
  },
  reassignBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1,
    borderColor: T.border, backgroundColor: T.card,
  },
  reassignBtnOccupied: { opacity: 0.28 },
  reassignBtnText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: T.white,
  },
  reassignCancel: { marginLeft: "auto" as any, padding: 4 },
  reassignCancelText: {
    fontSize: 12, color: T.textDim, fontFamily: "Inter_600SemiBold",
  },
});
