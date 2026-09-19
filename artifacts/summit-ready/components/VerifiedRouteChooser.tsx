import { ChevronRight, Mountain } from "lucide-react-native";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { T } from "@/constants/theme";

export interface VerifiedTargetRouteChoice {
  identityKey: string;
  routeId?: string | null;
  version?: string | null;
  mountainId?: string | null;
  routeName: string;
  startPoint: string | null;
  distanceKm: number | null;
  totalAscentMetres: number | null;
  typicalDurationHours: number | null;
}

interface VerifiedRouteChooserProps {
  visible: boolean;
  routes: VerifiedTargetRouteChoice[];
  onSelect: (route: VerifiedTargetRouteChoice) => void;
  onClose: () => void;
}

export function VerifiedRouteChooser({
  visible,
  routes,
  onSelect,
  onClose,
}: VerifiedRouteChooserProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.headingRow}>
          <View style={s.iconWrap}>
            <Mountain size={18} color={T.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Choose the target route</Text>
            <Text style={s.subtitle}>
              Select the verified route you want your local expedition to simulate.
            </Text>
          </View>
        </View>
        <ScrollView
          style={s.routeList}
          contentContainerStyle={{ gap: 9, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {routes.map((route, index) => (
            <TouchableOpacity
              key={route.identityKey}
              testID={`verified-route-choice-${route.identityKey}`}
              accessibilityRole="button"
              activeOpacity={0.75}
              style={s.routeRow}
              onPress={() => onSelect(route)}
            >
              <View style={s.numberBadge}>
                <Text style={s.numberText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.routeName}>{route.routeName}</Text>
                <Text style={s.routeFacts}>
                  {[
                    route.startPoint ? `From ${route.startPoint}` : null,
                    route.totalAscentMetres != null
                      ? `${route.totalAscentMetres.toLocaleString()}m ascent`
                      : null,
                    route.distanceKm != null ? `${route.distanceKm}km` : null,
                    route.typicalDurationHours != null
                      ? `${route.typicalDurationHours}h`
                      : null,
                  ].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <ChevronRight size={17} color={T.blue} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: T.blueDim,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
  routeList: {
    marginTop: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.blueDim,
  },
  numberText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: T.blue,
  },
  routeName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: T.white,
  },
  routeFacts: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    color: T.textMuted,
  },
});