import { ArrowLeft, CheckCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { CURATED_HILLS } from "@/constants/trailData";
import type { Trail } from "@/constants/trailData";
import { TrailCard } from "@/components/TrailCard";
import { readLiveTrailsFromCache } from "@/utils/liveTrailsCache";

export default function TrailsCompletedScreen() {
  const insets = useSafeAreaInsets();
  const { completedTrailIds, savedTrailIds, customRoutes } = useApp();
  const [liveTrails, setLiveTrails] = useState<Trail[]>([]);

  useEffect(() => {
    readLiveTrailsFromCache().then(setLiveTrails);
  }, []);

  const completed = useMemo(() => {
    const all = [...customRoutes, ...liveTrails, ...CURATED_HILLS];
    return all.filter((t) => completedTrailIds.includes(t.id));
  }, [completedTrailIds, customRoutes, liveTrails]);

  const totalKm = completed.reduce((sum, t) => sum + t.distance, 0);
  const totalElevation = completed.reduce((sum, t) => sum + t.elevationGain, 0);

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
            <Text style={s.title}>Completed Routes</Text>
          </View>
        </Animated.View>

        {completed.length > 0 && (
          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.statsCard}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{completed.length}</Text>
              <Text style={s.statLbl}>Routes completed</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{totalKm.toFixed(0)}km</Text>
              <Text style={s.statLbl}>Total distance</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{totalElevation.toLocaleString()}m</Text>
              <Text style={s.statLbl}>Elevation gained</Text>
            </View>
          </Animated.View>
        )}

        {completed.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.empty}>
            <CheckCircle size={40} color={T.textDim} />
            <Text style={s.emptyTitle}>No completed routes yet</Text>
            <Text style={s.emptyBody}>
              Open any trail and tap{" "}
              <Text style={{ color: T.green, fontFamily: "Inter_600SemiBold" }}>Mark complete</Text>
              {" "}to track your progress here.
            </Text>
            <TouchableOpacity style={s.browseBtn} onPress={() => router.push("/trail-list")} activeOpacity={0.85}>
              <Text style={s.browseBtnText}>Browse all trails</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={s.list}>
            <Text style={s.count}>{completed.length} route{completed.length !== 1 ? "s" : ""} completed</Text>
            {completed.map((trail, i) => (
              <Animated.View key={trail.id} entering={FadeInDown.delay(i * 50).duration(400)}>
                <TrailCard
                  trail={trail}
                  isSaved={savedTrailIds.includes(trail.id)}
                  isCompleted
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
  statsCard: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 16, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 4 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.green },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: T.border },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center", lineHeight: 20 },
  browseBtn: { marginTop: 8, backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40", paddingHorizontal: 20, paddingVertical: 11 },
  browseBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: T.green },
  list: { gap: 10 },
  count: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim },
});
