/**
 * A collapsed route in the Routes list.
 *
 * Pressing it selects the route, which expands its detail IN PLACE directly
 * below — there is no separate Route Detail screen, and this card never
 * navigates anywhere.
 *
 * It shows only figures the engine or the catalogue actually recorded. A route
 * with no distance simply has no distance line; nothing is estimated to keep
 * the row looking full.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, Route as RouteIcon, TrendingUp, Clock } from "lucide-react-native";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import { SRPanel } from "@/components/ui";
import { VerificationBadge } from "./parts";
import type { PresentedFact, PresentedRoute } from "@/utils/mountainDetailPresentation";

const HEADLINE_ICON: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  distance: RouteIcon,
  ascent: TrendingUp,
  time: Clock,
};

export function RouteCard({
  route, selected, onPress,
}: { route: PresentedRoute; selected: boolean; onPress: () => void }) {
  return (
    <SRPanel
      radius={15}
      onPress={onPress}
      accessibilityLabel={`${route.name}${selected ? ", selected" : ""}`}
      accessibilityHint={selected ? "Collapses this route" : "Shows this route's detail below"}
      style={selected ? styles.selected : undefined}
      testID={`route-card-${route.key}`}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <View style={styles.badges}>
            {route.verification !== "verified" ? (
              <VerificationBadge state={route.verification} compact />
            ) : null}
          </View>
          <Text style={styles.name} numberOfLines={3}>{route.name}</Text>
          {route.headline.length > 0 ? (
            <View style={styles.headline}>
              {route.headline.map(f => <HeadlineFact key={f.key} fact={f} />)}
            </View>
          ) : null}
          {route.aliases.length > 0 ? (
            <Text style={styles.aliases} numberOfLines={1}>{route.aliases.join(" · ")}</Text>
          ) : null}
        </View>
        {selected
          ? <ChevronUp size={14} color={EXPLORE.accent} />
          : <ChevronDown size={14} color={BASECAMP.textFaint} />}
      </View>
    </SRPanel>
  );
}

function HeadlineFact({ fact }: { fact: PresentedFact }) {
  const Icon = HEADLINE_ICON[fact.key];
  return (
    <View style={styles.headlineItem}>
      {Icon ? <Icon size={11} color={BASECAMP.textDim} /> : null}
      <Text style={styles.headlineText} numberOfLines={1}>{fact.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { borderColor: EXPLORE.accentLine },
  row: { flexDirection: "row", alignItems: "center", gap: 11, padding: 11 },
  body: { flex: 1, minWidth: 0 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  name: { ...TYPE.bodyBold, fontSize: 13.5, lineHeight: 17, color: BASECAMP.text },
  headline: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 },
  headlineItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  headlineText: { ...TYPE.caption, fontSize: 10.5, color: BASECAMP.textMuted },
  aliases: { marginTop: 4, fontSize: 10, lineHeight: 13, fontFamily: "Inter_400Regular", color: BASECAMP.textDim },
});

export const ROUTE_CARD_RADIUS = RADIUS.lg;
export const ROUTE_CARD_GAP = SP.sm + 1;
