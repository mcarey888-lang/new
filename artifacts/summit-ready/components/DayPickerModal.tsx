import React from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Check, Flag, RotateCcw, TrendingUp, X } from "lucide-react-native";
import { T } from "@/constants/theme";
import { DAY_SHORT } from "@/utils/dayAssignment";

// Mon → Sun display order
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function sessionTypeIcon(type: string, size = 11) {
  if (type === "hill")   return <TrendingUp size={size} color={T.green} />;
  if (type === "bigDay") return <Flag size={size} color={T.orange} />;
  return <Activity size={size} color={T.blue} />;
}

function sessionTypeColor(type: string) {
  if (type === "hill")   return T.green;
  if (type === "bigDay") return T.orange;
  return T.blue;
}

/**
 * Returns the date number for a given day-of-week within the week that starts on weekStartDate.
 */
function dateForDow(weekStartDate: string, targetDow: number): number {
  const start = new Date(weekStartDate + "T12:00:00");
  const diff = (targetDow - start.getDay() + 7) % 7;
  const d = new Date(start);
  d.setDate(d.getDate() + diff);
  return d.getDate();
}

export interface OccupiedDay {
  label: string;
  type: "cardio" | "hill" | "bigDay";
}

interface Props {
  visible: boolean;
  sessionLabel: string;
  weekStartDate?: string;
  /** Current day-of-week assignment for this session (0=Sun…6=Sat), or null if unscheduled */
  currentDow: number | null;
  /** Days occupied by OTHER sessions this week */
  occupiedDows: Partial<Record<number, OccupiedDay>>;
  /** User's preferred training days from availableDays */
  preferredDows?: number[];
  /** True if there's a manual override in place (shows "Reset to auto" button) */
  hasOverride: boolean;
  onSelect: (dow: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export function DayPickerModal({
  visible,
  sessionLabel,
  weekStartDate,
  currentDow,
  occupiedDows,
  preferredDows = [],
  hasOverride,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={dp.backdrop} activeOpacity={1} onPress={onClose} />

      <View
        style={[
          dp.sheet,
          { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 },
        ]}
      >
        {/* Handle */}
        <View style={dp.handle} />

        {/* Header */}
        <View style={dp.header}>
          <View style={{ flex: 1 }}>
            <Text style={dp.title}>Schedule Session</Text>
            <Text style={dp.subtitle} numberOfLines={1}>{sessionLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Day grid */}
        <View style={dp.grid}>
          {DISPLAY_ORDER.map((dow) => {
            const isSelected = dow === currentDow;
            const occupied = occupiedDows[dow];
            const isOccupied = !!occupied && !isSelected;
            const isPreferred = preferredDows.includes(dow);
            const tc = occupied ? sessionTypeColor(occupied.type) : T.blue;

            return (
              <TouchableOpacity
                key={dow}
                style={[
                  dp.dayCell,
                  isSelected && dp.dayCellSelected,
                  isOccupied && dp.dayCellOccupied,
                ]}
                onPress={() => !isOccupied && onSelect(dow)}
                activeOpacity={isOccupied ? 1 : 0.75}
                disabled={isOccupied}
              >
                {/* Day name */}
                <Text style={[
                  dp.dayName,
                  isSelected && { color: T.blue },
                  isOccupied && { color: T.textDim },
                ]}>
                  {DAY_SHORT[dow]}
                </Text>

                {/* Date number */}
                {weekStartDate && (
                  <Text style={[
                    dp.dayDate,
                    isSelected && { color: T.blue },
                    isOccupied && { color: T.textDim },
                  ]}>
                    {dateForDow(weekStartDate, dow)}
                  </Text>
                )}

                {/* Pill */}
                <View style={[
                  dp.pill,
                  isSelected && { backgroundColor: T.blue + "25", borderColor: T.blue },
                  isOccupied && { backgroundColor: tc + "15", borderColor: tc + "50" },
                ]}>
                  {isSelected ? (
                    <Check size={12} color={T.blue} strokeWidth={3} />
                  ) : isOccupied ? (
                    sessionTypeIcon(occupied.type, 12)
                  ) : (
                    <View style={[dp.emptyDot, isPreferred && { backgroundColor: T.green + "80" }]} />
                  )}
                </View>

                {/* Preferred training day dot */}
                {isPreferred && !isSelected && !isOccupied && (
                  <View style={dp.preferredDot} />
                )}

                {/* Occupied label */}
                {isOccupied && (
                  <Text style={[dp.occupiedLabel, { color: tc }]} numberOfLines={1}>
                    taken
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={dp.legend}>
          <View style={dp.legendItem}>
            <View style={[dp.legendDot, { backgroundColor: T.green }]} />
            <Text style={dp.legendText}>Your training days</Text>
          </View>
          <View style={dp.legendItem}>
            <View style={[dp.legendDot, { backgroundColor: T.textDim }]} />
            <Text style={dp.legendText}>Another session</Text>
          </View>
        </View>

        {/* Reset button */}
        {hasOverride && (
          <TouchableOpacity style={dp.resetBtn} onPress={onClear} activeOpacity={0.8}>
            <RotateCcw size={13} color={T.textMuted} />
            <Text style={dp.resetText}>Reset — let plan decide</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const dp = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    marginTop: 2,
  },

  // 7-column grid
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: T.blue + "12",
  },
  dayCellOccupied: {
    opacity: 0.55,
  },
  dayName: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dayDate: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  pill: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
  },
  preferredDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.green,
    marginTop: -2,
  },
  occupiedLabel: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: -2,
  },

  // Legend
  legend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
  },

  // Reset button
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    marginBottom: 4,
  },
  resetText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: T.textMuted,
  },
});
