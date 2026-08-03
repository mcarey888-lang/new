import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { DEV_PROFILES, loadDevProfile, type DevProfile } from "@/utils/devProfiles";
import { useApp } from "@/context/AppContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DevToolsModal({ visible, onClose }: Props) {
  const { reloadApp } = useApp();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleLoad(profile: DevProfile) {
    setLoading(profile.id);
    try {
      await loadDevProfile(profile);
      onClose();
      await reloadApp();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.header}>
          <Text style={s.title}>🛠 Dev Profiles</Text>
          <Text style={s.subtitle}>Load a simulated user — tap to switch instantly</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {DEV_PROFILES.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              style={[s.card, { borderColor: profile.color + "40" }]}
              activeOpacity={0.75}
              onPress={() => handleLoad(profile)}
              disabled={loading !== null}
            >
              <View style={[s.iconWrap, { backgroundColor: profile.color + "20" }]}>
                <Text style={s.emoji}>{profile.emoji}</Text>
              </View>
              <View style={s.cardText}>
                <Text style={s.cardLabel}>{profile.label}</Text>
                <Text style={s.cardDesc}>{profile.description}</Text>
              </View>
              {loading === profile.id
                ? <ActivityIndicator size="small" color={profile.color} />
                : <Text style={[s.arrow, { color: profile.color }]}>→</Text>
              }
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={s.demoBtn}
            onPress={() => { onClose(); router.push("/mountain-demo"); }}
          >
            <Text style={s.demoBtnText}>🏔  Mountain Progress Demo</Text>
          </TouchableOpacity>
          <Text style={s.footerNote}>Dev tools only — hidden from regular users</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: T.border,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: T.text,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emoji: {
    fontSize: 22,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.text,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  arrow: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    alignItems: "center",
  },
  footerNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: T.textDim,
  },
  closeBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.textMuted,
  },
  demoBtn: {
    alignSelf: "stretch",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  demoBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: T.text,
  },
});
