import { Image } from "expo-image";
import { Camera, ChevronRight, LockKeyhole, Mountain, TrendingUp } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BASECAMP, SP, TYPE } from "@/constants/tokens";
import { savedDemoYear } from "@/utils/savedDemoYear";

type Year = ReturnType<typeof savedDemoYear>;
const approvedBase = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/artwork/approved`
  : "/api/artwork/approved";
const PHOTOS = [
  { id: "ridge", title: "First light above the ridge", hikeIndex: 22, image: require("@/assets/images/hero-base-camp.png"), description: "Illustrative hiker at sunrise" },
  { id: "montblanc", title: "The long climb", hikeIndex: 12, image: { uri: `${approvedBase}/SR-MTN-MONTBLANC-001/hero` }, description: "Illustrative Mont Blanc artwork" },
  { id: "matterhorn", title: "A year looking upwards", hikeIndex: 2, image: { uri: `${approvedBase}/SR-MTN-MATTERHORN-001/hero` }, description: "Illustrative Matterhorn artwork" },
];

export function SavedDemoYearSummary({
  year, onRemove, busy, onOpenActivity, onOpenPhotos,
}: {
  year: Year;
  onRemove: () => void;
  busy: boolean;
  onOpenActivity: () => void;
  onOpenPhotos: () => void;
}) {
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const pair = year.hikes.slice((11 - index) * 2, (12 - index) * 2);
    return {
      label: new Date(`${pair[0].date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" }),
      ascentM: pair.reduce((sum, hike) => sum + hike.ascentM, 0),
    };
  });
  const maxMonth = Math.max(1, ...monthly.map(month => month.ascentM));
  return (
    <View style={s.panel} testID="saved-demo-year-summary">
      <Text style={s.eyebrow}>SAVED SAMPLE YEAR · PRIVATE</Text>
      <Text style={s.title}>A year in the mountains</Text>
      <View style={s.heroRow}>
        <TrendingUp size={22} color={BASECAMP.accent} />
        <Text style={s.heroValue}>{year.ascentM.toLocaleString("en-GB")} m</Text>
      </View>
      <Text style={s.heroCaption}>FICTIONAL ASCENT · NOT BANKED</Text>
      <View style={s.statRow}>
        <View style={s.stat}><Text style={s.value}>{year.hikes.length}</Text><Text style={s.small}>sample hikes</Text></View>
        <View style={s.stat}><Text style={s.value}>{year.expeditions.length}</Text><Text style={s.small}>sample expeditions</Text></View>
        <View style={s.stat}><Text style={s.value}>12</Text><Text style={s.small}>sample months</Text></View>
      </View>
      <Text style={s.eyebrow}>MONTHLY ASCENT · SAMPLE</Text>
      <View style={s.chartRow}>
        {monthly.map((month, index) => (
          <View key={`${month.label}-${index}`} style={s.barSlot} accessible accessibilityLabel={`${month.label}: ${month.ascentM} metres of fictional ascent`}>
            <View style={s.barTrack}>
              <View style={[s.bar, { height: Math.max(3, Math.round(month.ascentM / maxMonth * 68)) }]} />
            </View>
            <Text style={s.monthLabel} numberOfLines={1}>{month.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.eyebrow}>EXPEDITIONS COMPLETED · SAMPLE</Text>
      {year.expeditions.map(expedition => (
        <View key={expedition.name} style={s.expeditionRow}>
          <Mountain size={15} color={BASECAMP.accent} />
          <Text style={[s.row, { flex: 1 }]}>{expedition.name}</Text>
          <Text style={s.small}>{new Date(`${expedition.completedAt}T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</Text>
        </View>
      ))}
      <Text style={[s.eyebrow, { marginTop: 18 }]}>RECENT SAMPLE HIKES</Text>
      {year.hikes.slice(0, 2).map(hike => (
        <View key={hike.id} style={s.hikeRow}>
          <Text style={s.row}>{hike.name}</Text>
          <Text style={s.small}>{hike.ascentM} m · {new Date(`${hike.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Text>
        </View>
      ))}
      <View style={s.links}>
        <TouchableOpacity onPress={onOpenActivity} style={s.link} accessibilityRole="button" testID="sample-year-open-activity">
          <Text style={s.linkText}>All 24 hikes</Text><ChevronRight size={15} color={BASECAMP.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenPhotos} style={s.link} accessibilityRole="button" testID="sample-year-open-photos">
          <Camera size={15} color={BASECAMP.accent} /><Text style={s.linkText}>Photo stories</Text><ChevronRight size={15} color={BASECAMP.accent} />
        </TouchableOpacity>
      </View>
      <Text style={s.note}>These fictional examples are only visible to you. Your real Elevation Bank, challenges and public posts are unchanged.</Text>
      <TouchableOpacity onPress={onRemove} disabled={busy} accessibilityRole="button" style={s.remove} testID="remove-saved-demo-year">
        <Text style={s.removeText}>{busy ? "Updating…" : "Remove sample year"}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SavedDemoYearActivity({ year }: { year: Year }) {
  return (
    <View style={s.panel} testID="saved-demo-year-activity">
      <Text style={s.eyebrow}>SAMPLE ACTIVITY · PRIVATE</Text>
      <Text style={s.note}>A fictional year of {year.hikes.length} hikes. None count toward challenges or verified ascent.</Text>
      {year.hikes.map(hike => (
        <View key={hike.id} style={s.activityRow}>
          <Text style={s.row}>{hike.name}</Text>
          <Text style={s.small}>{new Date(`${hike.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {hike.ascentM} m sample ascent</Text>
        </View>
      ))}
    </View>
  );
}

export function SavedDemoYearPhotos({ year }: { year: Year }) {
  return (
    <View style={s.panel} testID="saved-demo-year-photos">
      <Text style={s.eyebrow}>SAMPLE PHOTO STORIES · PRIVATE</Text>
      <Text style={s.note}>Illustrative images for your fictional year. They are not your photographs and are never shared with members.</Text>
      {PHOTOS.map(post => (
        <View key={post.id} style={s.photoPost}>
          <Image source={post.image} style={s.photo} contentFit="cover" accessibilityLabel={post.description} />
          <View style={s.photoCaption}><Text style={s.row}>{post.title}</Text><LockKeyhole size={14} color={BASECAMP.textDim} /></View>
          <Text style={s.small}>
            {new Date(`${year.hikes[post.hikeIndex].date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Sample story · Only you
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: "#0B1B2B", borderColor: BASECAMP.accentLine, borderWidth: 1, borderRadius: 16, padding: SP.md, marginBottom: SP.md },
  eyebrow: { ...TYPE.smallBold, color: BASECAMP.accent, letterSpacing: 1.1, marginBottom: 9 },
  title: { ...TYPE.heading, color: BASECAMP.text, marginBottom: 7 },
  note: { ...TYPE.caption, color: BASECAMP.textMuted, lineHeight: 19, marginBottom: 16 },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  stat: { flex: 1, gap: 6, backgroundColor: BASECAMP.panelSub, borderRadius: 10, padding: 12 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 5 },
  heroValue: { fontSize: 36, fontFamily: "Inter_700Bold", color: BASECAMP.text },
  heroCaption: { ...TYPE.smallBold, color: BASECAMP.accent, letterSpacing: 0.8, marginBottom: 17 },
  chartRow: { flexDirection: "row", gap: 3, marginBottom: 22 },
  barSlot: { flex: 1, minWidth: 0 },
  barTrack: { height: 72, justifyContent: "flex-end" },
  bar: { backgroundColor: BASECAMP.accent, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  monthLabel: { fontSize: 8, color: BASECAMP.textDim, textAlign: "center", marginTop: 4 },
  expeditionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  hikeRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 7 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, marginBottom: 18 },
  link: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 6 },
  linkText: { ...TYPE.caption, color: BASECAMP.accent },
  value: { ...TYPE.bodyBold, color: BASECAMP.text },
  small: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 2 },
  row: { ...TYPE.body, color: BASECAMP.text },
  remove: { marginTop: 17, paddingVertical: 10, alignSelf: "flex-start" },
  removeText: { ...TYPE.caption, color: BASECAMP.textMuted, textDecorationLine: "underline" },
  activityRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  photoPost: { marginBottom: 22 },
  photo: { width: "100%", height: 174, borderRadius: 10, marginBottom: 9 },
  photoCaption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});