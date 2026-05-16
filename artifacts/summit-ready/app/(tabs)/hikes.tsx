import {
  Bookmark,
  CheckCircle,
  ChevronRight,
  Compass,
  Map,
  Pencil,
  Plus,
  TriangleIcon,
  Trash2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T } from "@/constants/theme";
import { useApp, type ExploreHike } from "@/context/AppContext";
import { LogHikeModal } from "@/components/LogHikeModal";

// ── Logged hike row ───────────────────────────────────────────────────────────

function LoggedHikeRow({ hike, onDelete }: { hike: ExploreHike; onDelete: (id: string) => void }) {
  const dateStr = new Date(hike.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <View style={lh.row}>
      <View style={lh.iconWrap}>
        <Map size={14} color={T.green} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={lh.name}>{hike.name}</Text>
        <View style={lh.meta}>
          <Text style={lh.dim}>{dateStr}</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.distance}km</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.elevationGain}m gain</Text>
          <Text style={lh.dot}>·</Text>
          <Text style={lh.dim}>{hike.timeTaken}min</Text>
        </View>
        {!!hike.notes && <Text style={lh.notes}>{hike.notes}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS === "web") { onDelete(hike.id); return; }
          Alert.alert("Delete session?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(hike.id) },
          ]);
        }}
        style={lh.delBtn}
        hitSlop={8}
      >
        <Trash2 size={14} color={T.red} />
      </TouchableOpacity>
    </View>
  );
}

const lh = StyleSheet.create({
  row: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.greenDim, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  dim: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  dot: { fontSize: 12, color: T.textDim },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textDim, fontStyle: "italic" },
  delBtn: { padding: 4, flexShrink: 0 },
});

// ── Category card ─────────────────────────────────────────────────────────────

interface CategoryCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  badge?: number;
}

function CategoryCard({ emoji, title, subtitle, color, onPress, badge }: CategoryCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={cc.card}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={[color + "14", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[cc.iconBox, { backgroundColor: color + "22" }]}>
        <Text style={cc.emoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={cc.title} numberOfLines={1}>{title}</Text>
        <Text style={cc.subtitle} numberOfLines={1}>
          {badge != null && badge > 0 ? `${badge} ${subtitle}` : subtitle}
        </Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={[cc.badge, { backgroundColor: color + "22" }]}>
          <Text style={[cc.badgeText, { color }]}>{badge}</Text>
        </View>
      )}
      <ChevronRight size={15} color={T.textDim} />
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden",
    minHeight: 72,
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emoji: { fontSize: 18 },
  title: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.text },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HikesScreen() {
  const insets = useSafeAreaInsets();
  const {
    exploreHikes, deleteExploreHike,
    savedTrailIds, completedTrailIds, customRoutes,
  } = useApp();

  const [logVisible, setLogVisible] = useState(false);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          p.scroll,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 20, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(40).duration(600)} style={p.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={p.eyebrow}>EXPLORE MODE</Text>
            <Text style={p.title}>Explore Trails</Text>
          </View>
          <TouchableOpacity style={p.logFab} onPress={() => setLogVisible(true)} activeOpacity={0.85}>
            <Plus size={15} color={T.green} />
            <Text style={p.logFabText}>Log session</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats strip */}
        <Animated.View entering={FadeInDown.delay(60).duration(600)} style={p.statsStrip}>
          <View style={p.statItem}>
            <Text style={p.statVal}>{savedTrailIds.length}</Text>
            <Text style={p.statLbl}>Saved</Text>
          </View>
          <View style={p.statDivider} />
          <View style={p.statItem}>
            <Text style={[p.statVal, { color: T.green }]}>{completedTrailIds.length}</Text>
            <Text style={p.statLbl}>Completed</Text>
          </View>
          <View style={p.statDivider} />
          <View style={p.statItem}>
            <Text style={[p.statVal, { color: T.purple }]}>{customRoutes.length}</Text>
            <Text style={p.statLbl}>Custom routes</Text>
          </View>
          <View style={p.statDivider} />
          <View style={p.statItem}>
            <Text style={[p.statVal, { color: T.orange }]}>{exploreHikes.length}</Text>
            <Text style={p.statLbl}>Sessions logged</Text>
          </View>
        </Animated.View>

        {/* Category grid */}
        <Animated.View entering={FadeInDown.delay(80).duration(600)} style={p.grid}>
          <CategoryCard
            emoji="🗺️"
            title="Nearby Trails"
            subtitle="Browse trails"
            color={T.blue}
            onPress={() => router.push("/trail-list")}
          />
          <CategoryCard
            emoji="⛰️"
            title="Training Hills"
            subtitle="AI-powered hill lookup"
            color={T.orange}
            onPress={() => router.push("/hills-finder")}
          />
          <CategoryCard
            emoji="🔖"
            title="Saved Routes"
            subtitle="Trails you've bookmarked"
            color={T.blue}
            badge={savedTrailIds.length}
            onPress={() => router.push("/trails-saved")}
          />
          <CategoryCard
            emoji="✅"
            title="Completed Trails"
            subtitle="Trails you've finished"
            color={T.green}
            badge={completedTrailIds.length}
            onPress={() => router.push("/trails-completed")}
          />
          {/* Row 3 — full width */}
          <TouchableOpacity
            style={p.createCard}
            onPress={() => router.push("/trails-create")}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={[T.purple + "14", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={[p.createIcon, { backgroundColor: T.purple + "22" }]}>
              <Pencil size={18} color={T.purple} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={p.createTitle}>Create My Own Route</Text>
              <Text style={p.createSubtitle}>
                {customRoutes.length > 0
                  ? `${customRoutes.length} custom route${customRoutes.length !== 1 ? "s" : ""} saved`
                  : "Add a personalised trail to your library"}
              </Text>
            </View>
            <ChevronRight size={16} color={T.textDim} />
          </TouchableOpacity>
        </Animated.View>

        {/* Recent activity */}
        <Animated.View entering={FadeInDown.delay(120).duration(600)} style={p.sectionHeader}>
          <Text style={p.sectionTitle}>Recent activity</Text>
          {exploreHikes.length > 0 && (
            <TouchableOpacity onPress={() => setLogVisible(true)} style={p.addBtn}>
              <Plus size={13} color={T.green} />
              <Text style={p.addBtnText}>Log</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {exploreHikes.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(140).duration(600)} style={p.emptyActivity}>
            <Compass size={28} color={T.textDim} />
            <Text style={p.emptyTitle}>No sessions logged yet</Text>
            <Text style={p.emptyBody}>Tap the button above after a hike to record your sessions.</Text>
          </Animated.View>
        ) : (
          <View style={p.activityList}>
            {exploreHikes.map((hike, i) => (
              <Animated.View key={hike.id} entering={FadeInDown.delay(140 + i * 40).duration(500)}>
                <LoggedHikeRow hike={hike} onDelete={deleteExploreHike} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <LogHikeModal visible={logVisible} onClose={() => setLogVisible(false)} />
    </LinearGradient>
  );
}

const p = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: T.textDim, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: T.text },
  logFab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.greenDim, borderRadius: 12, borderWidth: 1, borderColor: T.green + "40",
    paddingHorizontal: 14, paddingVertical: 9,
  },
  logFabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.green },
  statsStrip: {
    flexDirection: "row", backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 14, justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 3 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: T.blue },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },
  grid: { gap: 10 },
  createCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 14, overflow: "hidden",
  },
  createIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  createTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  createSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: T.text },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.greenDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: T.green + "30",
  },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
  emptyActivity: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: T.text },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted, textAlign: "center" },
  activityList: { gap: 8 },
});
