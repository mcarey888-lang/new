import { Platform } from "react-native";

export function demoRoute(path: string): string {
  const mounted = Platform.OS === "web" && typeof window !== "undefined" &&
    (window.location.pathname === "/mobile" || window.location.pathname.startsWith("/mobile/"));
  return mounted ? `/mobile${path}` : path;
}