import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Activity, Check, ChevronRight, Layers, Mountain, Package,
  RefreshCw, TrendingUp, X,
} from "lucide-react-native";
import { T } from "@/constants/theme";

export type GymExercise =
  | "treadmill"
  | "stepper"
  | "box-steps"
  | "weighted-stairs"
  | "elliptical"
  | "outdoor";

interface ExerciseOption {
  key: GymExercise;
  label: string;
  subtitle: string;
  iconBg: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const EXERCISES: ExerciseOption[] = [
  {
    key: "treadmill",
    label: "Incline Treadmill",
    subtitle: "10–15% incline, brisk hike pace",
    iconBg: T.blue,
    Icon: TrendingUp,
  },
  {
    key: "stepper",
    label: "Stepper Machine",
    subtitle: "Step machine for leg drive and cardio",
    iconBg: T.orange,
    Icon: Layers,
  },
  {
    key: "box-steps",
    label: "Box Step-Ups",
    subtitle: "Weighted step-ups onto a box or bench",
    iconBg: "#7C3AED",
    Icon: Activity,
  },
  {
    key: "weighted-stairs",
    label: "Weighted Stairs",
    subtitle: "Stairs with a loaded pack or weight vest",
    iconBg: "#D97706",
    Icon: Package,
  },
  {
    key: "elliptical",
    label: "Elliptical (High Resistance)",
    subtitle: "High resistance, simulate climbing effort",
    iconBg: "#0891B2",
    Icon: RefreshCw,
  },
  {
    key: "outdoor",
    label: "Outdoor Walk / Run",
    subtitle: "Any outdoor terrain with elevation",
    iconBg: T.green,
    Icon: Mountain,
  },
];

interface Props {
  visible: boolean;
  current: GymExercise | null;
  onSelect: (exercise: GymExercise) => void;
  onClose: () => void;
}

export function ExercisePickerModal({ visible, current, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={ep.backdrop} activeOpacity={1} onPress={onClose} />

      <View
        style={[
          ep.sheet,
          { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 },
        ]}
      >
        {/* Handle */}
        <View style={ep.handle} />

        {/* Header */}
        <View style={ep.header}>
          <View style={ep.headerIcon}>
            <RefreshCw size={16} color={T.blue} />
          </View>
          <Text style={ep.title}>Swap Exercise</Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ marginLeft: "auto" }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={ep.caption}>
          Same elevation target — just a different way to train for it.
        </Text>

        {/* Scrollable exercise list */}
        <ScrollView
          style={ep.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {EXERCISES.map((ex) => {
            const isActive = current === ex.key;
            return (
              <TouchableOpacity
                key={ex.key}
                style={[ep.row, isActive && ep.rowActive]}
                onPress={() => onSelect(ex.key)}
                activeOpacity={0.8}
              >
                {/* Icon box */}
                <View style={[ep.iconBox, { backgroundColor: ex.iconBg + (isActive ? "FF" : "30") }]}>
                  <ex.Icon size={18} color={isActive ? "#fff" : ex.iconBg} />
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={[ep.rowLabel, isActive && { color: T.white }]}>
                    {ex.label}
                  </Text>
                  <Text style={ep.rowSub}>{ex.subtitle}</Text>
                </View>

                {/* Right indicator */}
                {isActive ? (
                  <View style={ep.checkCircle}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <ChevronRight size={16} color={T.textDim} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const ep = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "80%",
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
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: T.blue + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  caption: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    marginBottom: 14,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  rowActive: {
    // subtle tint handled by iconBox
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.blue,
    alignItems: "center",
    justifyContent: "center",
  },
});
