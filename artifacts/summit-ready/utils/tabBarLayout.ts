/** Full footprint of the absolute-positioned primary navigation, including safe area. */
export function primaryTabBarHeight(platform: string, bottomInset: number): number {
  return platform === "web" ? 80 : 62 + bottomInset;
}
