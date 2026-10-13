import { ArrowLeft, Map, TrendingUp, Clock, ChevronRight, Users } from "lucide-react-native";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/theme";
import { CommunityRecordingLibrary } from "@/components/track/CommunityRecordingLibrary";
import { useAuth } from "@clerk/expo";
import { activityApiBase } from "@/utils/activityAudience";

const API_BASE = activityApiBase;

interface CommunityRoute {
  id: string;
  name: string;
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  durationSecs: number;
  difficulty: string;
  startLat: number | null;
  startLng: number | null;
  notes: string;
  submittedAt: string;
}

function difficultyColor(d: string) {
  if (d === "Easy") return T.green;
  if (d === "Hard") return T.red;
  return T.orange;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function RouteCard({ route, index }: { route: CommunityRoute; index: number }) {
  const dc = difficultyColor(route.difficulty);
  const date = new Date(route.submittedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <TouchableOpacity
        style={r.card}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/hike-tracking",
            params: {
              referenceRouteId: route.id,
              referenceRouteName: route.name,
            },
          })
        }
      >
        <LinearGradient
          colors={[dc + "10", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={r.top}>
          <View style={[r.iconBox, { backgroundColor: dc + "20" }]}>
            <Map size={16} color={dc} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={r.name} numberOfLines={1}>{route.name}</Text>
            <Text style={r.date}>{date}</Text>
          </View>
          <View style={[r.diffBadge, { backgroundColor: dc + "20" }]}>
            <Text style={[r.diffText, { color: dc }]}>{route.difficulty}</Text>
          </View>
        </View>

        <View style={r.stats}>
          <View style={r.statItem}>
            <Map size={11} color={T.textDim} />
            <Text style={r.statText}>{route.distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={r.statItem}>
            <TrendingUp size={11} color={T.textDim} />
            <Text style={r.statText}>{route.elevationGain} m gain</Text>
          </View>
          <View style={r.statItem}>
            <Clock size={11} color={T.textDim} />
            <Text style={r.statText}>{formatDuration(route.durationSecs)}</Text>
          </View>
        </View>

        <View style={r.followRow}>
          <Text style={r.followText}>Follow this route</Text>
          <ChevronRight size={14} color={T.green} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CommunityRoutes(){
  const insets=useSafeAreaInsets();
  const[legacy,setLegacy]=useState(false);
  if(legacy)return <View style={{flex:1,backgroundColor:T.bg}}>
    <TouchableOpacity accessibilityRole="button" onPress={()=>setLegacy(false)} style={{padding:16,paddingTop:insets.top+12,minHeight:48}}>
      <Text style={{color:T.green}}>Back to member recordings</Text>
    </TouchableOpacity>
    <LegacyCommunityRoutes/>
  </View>;
  return <LinearGradient colors={T.bgGrad} style={{flex:1}}>
    <ScrollView contentContainerStyle={{paddingTop:Platform.OS==="web"?24:insets.top+8,paddingBottom:40}}>
      <TouchableOpacity accessibilityRole="button" onPress={()=>router.back()} style={{padding:16,minHeight:48}}>
        <Text style={{color:T.green}}>Back</Text>
      </TouchableOpacity>
      <CommunityRecordingLibrary/>
      <CommunityRecordingLibrary saved/>
      <TouchableOpacity accessibilityRole="button" onPress={()=>setLegacy(true)} style={{padding:16,minHeight:48}}>
        <Text style={{color:T.green}}>Earlier shared recordings (unverified)</Text>
        <Text style={{color:T.textMuted}}>Unknown historic sharing intent stays owner-only. Earlier merged geometry cannot be treated as an original GPS trace.</Text>
      </TouchableOpacity>
    </ScrollView>
  </LinearGradient>;
}
function LegacyCommunityRoutes() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken({ skipCache: true });
      if (!token) throw new Error("Sign in to load member routes");
      const res = await fetch(`${API_BASE}/tracked-routes`,{ headers:{Authorization:`Bearer ${token}`} });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json() as { routes: CommunityRoute[] };
      setRoutes(data.routes);
    } catch {
      setError("Couldn't load community routes. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  return (
    <LinearGradient colors={T.bgGrad} style={{ flex: 1 }}>
      {/* Header */}
      <View style={[h.header, { paddingTop: Platform.OS === "web" ? 60 : insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={h.back}>
          <ArrowLeft size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={h.title}>Community Routes</Text>
          <Text style={h.sub}>Routes tracked &amp; shared by other hikers</Text>
        </View>
        <View style={h.badge}>
          <Users size={13} color={T.blue} />
          <Text style={h.badgeText}>{routes.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={T.green} size="large" />
          <Text style={{ color: T.textMuted, fontSize: 14 }}>Loading routes…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <Map size={32} color={T.textDim} />
          <Text style={{ color: T.text, fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={loadRoutes} style={h.retryBtn}>
            <Text style={{ color: T.green, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : routes.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 }}>
          <Map size={32} color={T.textDim} />
          <Text style={{ color: T.text, fontSize: 15, fontFamily: "Inter_700Bold" }}>No community routes yet</Text>
          <Text style={{ color: T.textMuted, fontSize: 13, textAlign: "center" }}>
            Recordings appear for others only when their owner has chosen an audience that permits sharing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => <RouteCard route={item} index={index} />}
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const h = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  back: { padding: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: T.text },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.blueDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: T.blue + "30",
  },
  badgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: T.blue },
  retryBtn: {
    backgroundColor: T.greenDim, borderRadius: 6, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: T.green + "40",
  },
});

const r = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.border,
    padding: 14, gap: 10, overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name: { fontSize: 14, fontFamily: "Inter_700Bold", color: T.text },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", color: T.textMuted },
  diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  diffText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stats: { flexDirection: "row", gap: 16 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted },
  followRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4,
    borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 2,
  },
  followText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.green },
});
