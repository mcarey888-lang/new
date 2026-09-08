import { ChevronRight, Mountain } from "lucide-react-native";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { T } from "@/constants/theme";

export interface VerifiedMountainChoice {
  name: string;
  canonicalName?: string;
  country: string;
  region: string | null;
  canonicalSourceKey?: string;
}

interface VerifiedMountainChooserProps {
  visible: boolean;
  candidates: VerifiedMountainChoice[];
  onSelect: (candidate: VerifiedMountainChoice) => void;
  onClose: () => void;
}

export function VerifiedMountainChooser({
  visible,
  candidates,
  onSelect,
  onClose,
}: VerifiedMountainChooserProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.heading}>
          <View style={s.icon}>
            <Mountain size={18} color={T.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Which mountain do you mean?</Text>
            <Text style={s.subtitle}>
              Choose a verified location before selecting its route.
            </Text>
          </View>
        </View>
        <ScrollView
          style={{ marginTop: 16 }}
          contentContainerStyle={{ gap: 9, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {candidates.map((candidate, index) => {
            const displayName = candidate.canonicalName ?? candidate.name;
            const testKey = candidate.canonicalSourceKey
              ?? `${displayName}-${candidate.country}-${candidate.region ?? ""}`;
            return (
              <TouchableOpacity
                key={testKey}
                testID={`verified-mountain-choice-${testKey}`}
                accessibilityRole="button"
                activeOpacity={0.75}
                style={s.row}
                onPress={() => onSelect(candidate)}
              >
                <View style={s.numberBadge}>
                  <Text style={s.numberText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.name}>{displayName}</Text>
                  <Text style={s.location}>
                    {[candidate.region, candidate.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
                <ChevronRight size={17} color={T.blue} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    paddingTop: 10,
    paddingHorizontal: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
    backgroundColor: T.border,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.blueDim,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.blueDim,
  },
  numberText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: T.blue,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  location: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
});