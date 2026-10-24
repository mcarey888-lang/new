export function validWeatherCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function parseCoord(v: string | number | null | undefined): number | null {
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatHourLabel(unixSeconds: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone })
      .format(new Date(unixSeconds * 1000));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
      .format(new Date(unixSeconds * 1000));
  }
}

/** YYYY-MM-DD in the provider timezone. */
export function localDateKey(unixSeconds: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone,
    }).formatToParts(new Date(unixSeconds * 1000));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
  }
}

/** Calendar dates carry no zone; format them as UTC so the day never shifts. */
export function formatDayLabel(date: string, index: number, todayKey: string): string {
  if (date === todayKey) return "Today";
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

/** Index of the latest hour that has started, or -1 if none has. */
export function currentHourIndex(hours: { time: number }[], nowSeconds: number): number {
  let idx = -1;
  for (let i = 0; i < hours.length; i++) {
    if (hours[i].time <= nowSeconds && nowSeconds < hours[i].time + 3600) return i;
    if (hours[i].time <= nowSeconds) idx = -1;
  }
  return idx;
}

export function ageMinutes(iso: string, nowMs: number): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((nowMs - t) / 60000)) : null;
}

export function formatUpdated(iso: string, timeZone: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown time";
  return `${localDateKey(t / 1000, timeZone)} ${formatHourLabel(t / 1000, timeZone)}`;
}
