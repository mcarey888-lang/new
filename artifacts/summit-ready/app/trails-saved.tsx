import { ArrowLeft, Bookmark } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { SAMPLE_TRAILS } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";

export default function TrailsSavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedTrailIds, completedTrailIds, customRoutes } = useApp();

  const saved = useMemo(() => {
    const all = [...customRoutes, ...SAMPLE_TRAILS];
    return all.filter((t) => savedTrailIds.includes(t.id));
  }, [savedTrailIds, customRoutes]);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View>
            <Text style={s.eyebrow}>EXPLORE TRAILS</Text>
            <Text style={s.title}>Saved Routes</Text>
          </View>
        </Animated.View>

        {saved.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.empty}>
            <Bookmark size={40} color={T.textDim} />
            <Text style={s.emptyTitle}>No saved routes yet</Text>
            <Text style={s.emptyBody}>
              Browse trails and tap{" "}
              <Text style={{ color: T.blue, fontFamily: "Inter_600SemiBold" }}>Save route</Text>
              {" "}on any trail detail page to save it here.
            </Text>
            <TouchableOpacity style={s.browseBtn} onPress={() => router.push("/trail-list")} activeOpacity={0.85}>
              <Text style={s.browseBtnText}>Browse all trails</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={s.list}>
            <Text style={s.count}>{saved.length} saved route{saved.length !== 1 ? "s" : ""}</Text>
            {saved.map((trail, i) => (
              <Animated.View key={trail.id} entering={FadeInDown.delay(i * 50).duration(400)}>
                <TrailCard
                  trail={trail}
                  isSaved
                  isCompleted={completedTrailIds.includes(trail.id)}
                  onPress={() => router.push({ pathname: "/trail-detail", params: { id: trail.id } })}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  browseBtn: { marginTop: 8, backgroundColor: T.blueDim, borderRadius: 12, borderWidth: 1, borderColor: T.blue + "40", paddingHorizontal: 20, paddingVertical: 11 },
  browseBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.blue },
  list: { gap: 10 },
  count: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
});
