import { Image } from "expo-image";
import { Camera, ChevronRight, LockKeyhole, Mountain } from "lucide-react-native";
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
  return (
    <View style={s.panel} testID="saved-demo-year-summary">
      <Text style={s.eyebrow}>SAVED SAMPLE DETAILS · PRIVATE</Text>
      <Text style={s.title}>Your sample entries</Text>
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
          <Text style={s.linkText}>All {year.hikes.length} hikes</Text><ChevronRight size={15} color={BASECAMP.accent} />
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