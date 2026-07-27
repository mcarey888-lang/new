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
import { X } from "lucide-react-native";
import { T } from "@/constants/theme";

export type GymExercise = "treadmill" | "stepper" | "outdoor";

interface ExerciseOption {
  key: GymExercise;
  emoji: string;
  label: string;
  subtitle: string;
  hint: string;
}

const EXERCISES: ExerciseOption[] = [
  {
    key: "treadmill",
    emoji: "🏃",
    label: "Incline Treadmill",
    subtitle: "Walk at 10% incline to simulate hill gain",
    hint: "Best for steady gym cardio",
  },
  {
    key: "stepper",
    emoji: "🪜",
    label: "Stair Stepper",
    subtitle: "Machine-based climbing for pure vertical gain",
    hint: "Closest gym equivalent to real hills",
  },
  {
    key: "outdoor",
    emoji: "🌿",
    label: "Outdoor Walk / Run",
    subtitle: "Any outdoor terrain with elevation",
    hint: "Tracks target elevation gain directly",
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
      {/* Dimmed backdrop */}
      <TouchableOpacity style={ep.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View
        style={[
          ep.sheet,
          { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 },
        ]}
      >
        {/* Drag handle */}
        <View style={ep.handle} />

        {/* Header */}
        <View style={ep.header}>
          <Text style={ep.title}>Swap Exercise</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={ep.caption}>
          Same elevation target — just a different way to train for it.
        </Text>

        {/* Exercise options */}
        <View style={ep.options}>
          {EXERCISES.map((ex) => {
            const isActive = current === ex.key;
            return (
              <TouchableOpacity
                key={ex.key}
                style={[ep.option, isActive && ep.optionActive]}
                onPress={() => onSelect(ex.key)}
                activeOpacity={0.8}
              >
                <Text style={ep.emoji}>{ex.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[ep.optionLabel, isActive && { color: T.blue }]}>
                    {ex.label}
                  </Text>
                  <Text style={ep.optionSub}>{ex.subtitle}</Text>
                  <Text style={ep.optionHint}>{ex.hint}</Text>
                </View>
                {isActive && <View style={ep.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
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
    marginBottom: 16,
  },
  options: { gap: 10, marginBottom: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
  },
  optionActive: {
    borderColor: T.blue + "70",
    backgroundColor: T.blue + "12",
  },
  emoji: { fontSize: 26 },
  optionLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  optionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  optionHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.blue,
  },
});
