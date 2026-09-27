import React from "react";
import {
  Image,
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
  Check, ChevronRight, RefreshCw, X,
} from "lucide-react-native";
import { T } from "@/constants/theme";
import { exerciseThumbnailArtwork } from "@/utils/exerciseArtwork";

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
}

const EXERCISES: ExerciseOption[] = [
  {
    key: "treadmill",
    label: "Incline Treadmill",
    subtitle: "10–15% incline, brisk hike pace",
  },
  {
    key: "stepper",
    label: "Stairmaster",
    subtitle: "Step machine for leg drive and cardio",
  },
  {
    key: "box-steps",
    label: "Box Step-Ups",
    subtitle: "Weighted step-ups onto a box or bench",
  },
  {
    key: "weighted-stairs",
    label: "Weighted Stairs",
    subtitle: "Stairs with a loaded pack or weight vest",
  },
  {
    key: "elliptical",
    label: "Elliptical (High Resistance)",
    subtitle: "High resistance, simulate climbing effort",
  },
  {
    key: "outdoor",
    label: "Outdoor Walk / Run",
    subtitle: "Any outdoor terrain with elevation",
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
                style={ep.row}
                onPress={() => onSelect(ex.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                testID={`exercise-option-${ex.key}`}
              >
                <Image
                  source={exerciseThumbnailArtwork(ex.key)}
                  style={ep.thumbnail}
                  resizeMode="cover"
                  accessible={false}
                />

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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: T.border,
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
