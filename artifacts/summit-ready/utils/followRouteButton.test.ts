import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { PlannedRoute } from "./plannedRouteApi";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("expo-router", () => ({ router: { push } }));
vi.mock("react-native", () => ({
  Pressable: "Pressable", Text: "Text", StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/constants/tokens", () => ({ BASECAMP: { accent: "#24EFA4" }, TYPE: { body: {} } }));
import { FollowRouteButton } from "../components/track/FollowRouteButton";

const route: PlannedRoute = {
  id: "saved-personal-plan", name: "Glyders and Tryfan", hillSlug: null,
  anchors: [{ lat: 53.1, lng: -4 }, { lat: 53.11, lng: -4.01 }],
  geometry: [{ lat: 53.1, lng: -4 }, { lat: 53.11, lng: -4.01 }],
  legs: [{ kind: "routed" }], lengthM: 1500, ascentM: 500, descentM: 200, fullySnapped: true,
};
beforeEach(() => vi.clearAllMocks());

describe("Follow route button", () => {
  it("loads into the current map without navigating to a different screen", () => {
    const onFollow = vi.fn();
    const button = FollowRouteButton({ route, onFollow }) as ReactElement<{ onPress: () => void }>;
    button.props.onPress();
    expect(onFollow).toHaveBeenCalledWith(route);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the same map experience from a route list outside the map", () => {
    const button = FollowRouteButton({ route }) as ReactElement<{ onPress: () => void }>;
    button.props.onPress();
    expect(push).toHaveBeenCalledExactlyOnceWith({
      pathname: "/route-planner", params: { plannedRouteId: route.id },
    });
  });
});
