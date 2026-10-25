export type ParkingNavigationProvider = "default" | "google" | "waze";

/** Use only the selected mapped parking point, never substitute a summit or route start. */
export function parkingNavigationUrls(
  message: Record<string, unknown>, platform: string,
): { native: string; fallback: string } | null {
  const { lat, lng, provider, name } = message;
  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      !["default", "google", "waze"].includes(String(provider)) ||
      typeof name !== "string" || !name.trim() || name.length > 200) return null;
  const destination = `${lat},${lng}`;
  const encoded = encodeURIComponent(destination);
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  if (provider === "waze") return {
    native: platform === "web" ? `https://www.waze.com/ul?ll=${encoded}&navigate=yes` : `waze://?ll=${encoded}&navigate=yes`,
    fallback: `https://www.waze.com/ul?ll=${encoded}&navigate=yes`,
  };
  if (provider === "google") return {
    native: platform === "ios" ? `comgooglemaps://?daddr=${encoded}&directionsmode=driving`
      : platform === "android" ? `google.navigation:q=${encoded}&mode=d` : google,
    fallback: google,
  };
  return {
    native: platform === "ios" ? `maps://?daddr=${encoded}&dirflg=d`
      : platform === "android" ? `geo:0,0?q=${encodeURIComponent(`${destination}(${name})`)}` : google,
    fallback: google,
  };
}
