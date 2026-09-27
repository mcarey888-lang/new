import { Award, Users } from "lucide-react-native";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BASECAMP, SP, TYPE } from "@/constants/tokens";

// Presentation-only examples: never send these to the community API or use them
// as evidence for a member's achievements.
const examples = [
  {
    id: "morning-hills",
    name: "Samira K.",
    initial: "S",
    text: "A misty hill session before work. The climb felt tough, but I was glad I went.",
    image: require("@/assets/images/local-hill-illustration.png"),
    badge: null,
  },
  {
    id: "perfect-week",
    name: "Tom R.",
    initial: "T",
    text: "All my planned sessions done this week. Taking a rest day before the next one.",
    image: null,
    badge: "Perfect Week",
  },
  {
    id: "first-thousand",
    name: "Leah P.",
    initial: "L",
    text: "Little climbs add up. Looking forward to the next mountain day.",
    image: require("@/assets/images/hero-base-camp.png"),
    badge: "First Thousand",
  },
] as const;

export function DemoCommunityPreview() {
  return (
    <View style={styles.root} testID="community-demo-preview">
      <View style={styles.heading}>
        <Users size={17} color={BASECAMP.accent} />
        <Text style={styles.headingText}>Sample stories · fictional</Text>
      </View>
      <Text style={styles.disclaimer}>Preview only · Fictional members and achievements. These are not real posts or your progress.</Text>
      {examples.map(example => (
        <View key={example.id} style={styles.post} testID={`community-demo-${example.id}`}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{example.initial}</Text></View>
            <View style={styles.authorDetails}>
              <Text style={styles.name}>{example.name}</Text>
              <Text style={styles.meta}>Example member · Sample story</Text>
            </View>
          </View>
          {example.image && (
            <Image
              source={example.image}
              style={styles.image}
              contentFit="cover"
              accessibilityLabel="Illustrative mountain artwork for a sample story"
            />
          )}
          {example.badge && (
            <View style={styles.badge}>
              <Award size={16} color={BASECAMP.accent} />
              <Text style={styles.badgeText}>Sample achievement · {example.badge}</Text>
            </View>
          )}
          <Text style={styles.body}>{example.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: SP.md, marginBottom: SP.lg },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  headingText: { ...TYPE.bodyBold, color: BASECAMP.text },
  disclaimer: { ...TYPE.caption, color: BASECAMP.textMuted, lineHeight: 18, marginTop: 8 },
  post: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: BASECAMP.panelBorder },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: BASECAMP.accentDim, alignItems: "center", justifyContent: "center" },
  avatarText: { ...TYPE.bodyBold, color: BASECAMP.accent },
  authorDetails: { flex: 1 },
  name: { ...TYPE.bodyBold, color: BASECAMP.text },
  meta: { ...TYPE.caption, color: BASECAMP.textDim, marginTop: 2 },
  image: { width: "100%", height: 170, borderRadius: 10, marginTop: 12 },
  badge: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 13 },
  badgeText: { ...TYPE.smallBold, color: BASECAMP.accent },
  body: { ...TYPE.body, color: BASECAMP.text, lineHeight: 21, marginTop: 12 },
});