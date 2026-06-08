import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, Trophy } from "lucide-react-native";
import { T } from "@/constants/theme";
import { getChallenge } from "@/constants/challenges";
import { useChallenges } from "@/context/ChallengesContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  hillName: string;
  elevationGain: number;
  distance: number;
  date: string;
}

export function AddToChallengeSheet({
  visible,
  onClose,
  hillName,
  elevationGain,
  distance,
  date,
}: Props) {
  const { activeChallenges, logActivityOnly } = useChallenges();
  const [added, setAdded] = useState<string | null>(null);

  const openChallenges = activeChallenges.filter(ac => !ac.completed);

  async function handleAdd(challengeId: string) {
    if (added) return;
    await logActivityOnly({
      challengeId,
      title: hillName,
      date,
      elevationGain,
      distance,
      duration: 0,
      notes: "",
    });
    setAdded(challengeId);
    setTimeout(() => {
      setAdded(null);
      onClose();
    }, 1100);
  }

  function handleClose() {
    setAdded(null);
    onClose();
  }

  if (openChallenges.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <LinearGradient colors={T.bgGrad} style={StyleSheet.absoluteFill} />
          <View style={s.handle} />
          <View style={s.headRow}>
            <Trophy size={18} color={T.green} />
            <Text style={s.heading}>Add to a challenge?</Text>
          </View>
          <Text style={s.sub}>
            {elevationGain.toLocaleString()}m · {hillName}
          </Text>

          <View style={s.list}>
            {openChallenges.map(ac => {
              const tmpl = getChallenge(ac.challengeId);
              if (!tmpl) return null;
              const isAdded = added === ac.challengeId;
              return (
                <TouchableOpacity
                  key={ac.challengeId}
                  style={[s.row, isAdded && s.rowAdded]}
                  onPress={() => handleAdd(ac.challengeId)}
                  activeOpacity={0.75}
                  disabled={!!added}
                >
                  <Text style={s.emoji}>{tmpl.emoji}</Text>
                  <Text style={s.name} numberOfLines={1}>{tmpl.title}</Text>
                  {isAdded ? (
                    <View style={s.addedBadge}>
                      <CheckCircle size={14} color={T.green} />
                      <Text style={s.addedText}>Added!</Text>
                    </View>
                  ) : (
                    <View style={[s.addBadge, { borderColor: tmpl.color + "50", backgroundColor: tmpl.color + "18" }]}>
                      <Text style={[s.addBadgeText, { color: tmpl.color }]}>+ Add</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={s.skipBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 22,
    gap: 0,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 18,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  heading: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
    marginBottom: 18,
  },
  list: {
    gap: 10,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowAdded: {
    borderColor: T.green + "50",
    backgroundColor: T.greenDim,
  },
  emoji: {
    fontSize: 20,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.white,
  },
  addBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  addedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.green + "50",
    backgroundColor: T.greenDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addedText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: T.green,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
  },
});
