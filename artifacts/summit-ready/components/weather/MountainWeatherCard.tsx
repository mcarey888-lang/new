import React, { useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { ChevronRight, CloudSun, X } from "lucide-react-native";
import { getGetMountainWeatherQueryKey, getGetMountainDiscoveryQueryKey, useGetMountainWeather, useGetMountainDiscovery } from "@workspace/api-client-react";
import { BASECAMP, EXPLORE, RADIUS, SP, TYPE } from "@/constants/tokens";
import {
  ageMinutes, catalogueWeatherCoords, currentHourIndex, formatDayLabel, formatHourLabel, formatUpdated, localDateKey, validWeatherCoords,
} from "@/utils/mountainWeather";

const STALE_MIN = 60;
const open = (url: string) => { void Linking.openURL(url).catch(() => {}); };

export function MountainWeatherCard({ latitude, longitude, subjectName, country, catalogueId, testID }: {
  latitude: number | null | undefined; longitude: number | null | undefined; testID?: string;
  subjectName?: string; country?: string; catalogueId?: string;
}) {
  const insets = useSafeAreaInsets();
  const net = useNetInfo();
  const directCoords = validWeatherCoords(latitude, longitude);
  const subject = subjectName?.trim() ?? "";
  const needsCatalogue = !directCoords && subject.length >= 2;
  const discoveryParams = { q: subject, limit: 50 };
  const discovery = useGetMountainDiscovery(discoveryParams, {
    query: {
      queryKey: getGetMountainDiscoveryQueryKey(discoveryParams),
      enabled: needsCatalogue, retry: false, staleTime: 24 * 60 * 60 * 1000,
    },
  });
  const coords = directCoords ?? catalogueWeatherCoords(discovery.data, subject, country, catalogueId);
  const params = { lat: coords?.lat ?? 0, lng: coords?.lng ?? 0 };
  const q = useGetMountainWeather(params, {
    query: {
      queryKey: getGetMountainWeatherQueryKey(params),
      enabled: !!coords, retry: false, staleTime: 30 * 60 * 1000,
    },
  });
  const [sheet, setSheet] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);

  const w = q.data;
  const offline = net.isConnected === false;
  const nowSec = Math.floor(Date.now() / 1000);
  const todayKey = w ? localDateKey(nowSec, w.timezone) : "";
  const todayIdx = w ? Math.max(0, w.days.findIndex(d => d.date === todayKey)) : 0;
  const today = w?.days[todayIdx];
  const hourIdx = today ? currentHourIndex(today.hours, nowSec) : -1;
  const now = today ? (hourIdx >= 0 ? today.hours[hourIdx] : null) : null;
  const age = w ? ageMinutes(w.updatedAt, Date.now()) : null;
  const stale = age != null && age > STALE_MIN;
  const refreshFailed = !!w && q.isError;

  const notices: string[] = [];
  if (offline) notices.push("You are offline. Showing the last forecast received.");
  else if (refreshFailed) notices.push("Could not refresh. Showing the last forecast received.");
  if (stale) notices.push(`This forecast is ${age! >= 120 ? `${Math.round(age! / 60)} hours` : `${age} minutes`} old.`);

  const body = (() => {
    if (!coords) {
      if (needsCatalogue && discovery.isPending && discovery.fetchStatus === "fetching") {
        return <Text style={st.body}>Finding the forecast location…</Text>;
      }
      return <View style={{ gap: 8 }}>
        <Text style={st.body}>Weather is unavailable because this mountain's forecast location could not be confirmed.</Text>
        {needsCatalogue ? <Pressable accessibilityRole="button" onPress={() => void discovery.refetch()} style={st.btn}>
          <Text style={st.btnText}>Try location again</Text>
        </Pressable> : null}
      </View>;
    }
    if (q.isPending && q.fetchStatus === "fetching") {
      return <View testID="weather-loading" style={{ gap: 8 }}>
        <View style={[st.skel, { width: "55%", height: 28 }]} />
        <View style={[st.skel, { width: "90%", height: 14 }]} />
      </View>;
    }
    if (!w || !today) {
      return <View style={{ gap: 8 }}>
        <Text style={st.body}>{offline ? "Weather needs a connection and nothing is saved yet." : "Weather is unavailable right now."}</Text>
        <Pressable accessibilityRole="button" onPress={() => void q.refetch()} style={st.btn}>
          <Text style={st.btnText}>Try again</Text>
        </Pressable>
      </View>;
    }
    return (
      <View style={{ gap: 10 }}>
        {notices.map(n => <Text key={n} accessibilityRole="alert" style={st.notice}>{n}</Text>)}
        {now ? (
          <>
            <View style={st.row}>
              <Text style={st.temp}>{Math.round(now.temperatureC)}°C</Text>
              <Text style={st.cond} numberOfLines={2}>{now.condition}</Text>
            </View>
            <View style={st.stats}>
              <Stat label="Feels like" value={`${Math.round(now.feelsLikeC)}°C`} />
              <Stat label="Rain" value={`${Math.round(now.rainChance)}%`} />
              <Stat label="Wind" value={`${Math.round(now.windMph)} mph`} />
              {now.gustMph != null ? <Stat label="Gusts" value={`${Math.round(now.gustMph)} mph`} /> : null}
            </View>
          </>
        ) : (
          <Text style={st.body}>{`${today.condition}, ${Math.round(today.minC)} to ${Math.round(today.maxC)}°C, ${Math.round(today.rainChance)}% rain chance.`}</Text>
        )}
        <Pressable
          testID="weather-open-sheet" accessibilityRole="button" accessibilityLabel="Open weather outlook"
          onPress={() => { setDayIdx(todayIdx); setSheet(true); }} style={st.more}
        >
          <Text style={st.moreText}>{`${w.days.length}-day outlook and hourly detail`}</Text>
          <ChevronRight size={16} color={EXPLORE.accent} />
        </Pressable>
      </View>
    );
  })();

  const day = w?.days[Math.min(dayIdx, (w?.days.length ?? 1) - 1)];
  return (
    <View style={st.card} testID={testID ?? "mountain-weather-card"}>
      <View style={st.head}>
        <CloudSun size={14} color={EXPLORE.accent} />
        <Text style={st.eyebrow}>MOUNTAIN WEATHER</Text>
      </View>
      <Text style={st.label}>
        {w ? `Location forecast, not a summit forecast. Modelled for ${w.locationName}; mountain conditions can differ.`
          : "Location forecast, not a summit forecast."}
      </Text>
      {body}
      {w ? <Attribution updated={formatUpdated(w.updatedAt, w.timezone)} /> : null}

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={st.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close weather" onPress={() => setSheet(false)} />
          <View style={[st.sheet, { paddingBottom: (Platform.OS === "web" ? 16 : insets.bottom) + 12 }]}>
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Weather outlook</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close weather" onPress={() => setSheet(false)} style={st.close} hitSlop={8}>
                <X size={20} color={BASECAMP.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {w && day ? (
                <>
                  <Text style={st.label}>{`Location forecast, not a summit forecast. Modelled for ${w.locationName}; mountain conditions can differ. Times are local to ${w.timezone}.`}</Text>
                  {notices.map(n => <Text key={n} style={st.notice}>{n}</Text>)}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {w.days.map((d, i) => (
                      <Pressable
                        key={d.date} accessibilityRole="button" accessibilityState={{ selected: i === dayIdx }}
                        onPress={() => setDayIdx(i)} style={[st.dayChip, i === dayIdx && st.dayChipOn]}
                      >
                        <Text style={[st.dayName, i === dayIdx && { color: BASECAMP.text }]}>{formatDayLabel(d.date, i, todayKey)}</Text>
                        <Text style={st.dayTemp}>{`${Math.round(d.minC)} / ${Math.round(d.maxC)}°C`}</Text>
                        <Text style={st.dayRain}>{`${Math.round(d.rainChance)}% rain`}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={st.cond}>{`${day.condition}. ${Math.round(day.minC)} to ${Math.round(day.maxC)}°C, ${Math.round(day.rainChance)}% rain chance.`}</Text>
                  {dayIdx >= 3 ? <Text style={st.notice}>Longer-range outlook: conditions may change. Check again closer to your walk.</Text> : null}
                  {day.hours.length === 0 ? <Text style={st.body}>No hourly data supplied for this day.</Text> : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {day.hours.map(h => {
                        const isNow = nowSec >= h.time && nowSec < h.time + 3600;
                        return (
                          <View key={h.time} style={[st.hour, isNow && st.hourNow]}>
                            <Text style={st.hourTime}>{isNow ? "Now" : formatHourLabel(h.time, w.timezone)}</Text>
                            <Text style={st.hourTemp}>{`${Math.round(h.temperatureC)}°`}</Text>
                            <Text style={st.hourSub}>{`Feels ${Math.round(h.feelsLikeC)}°`}</Text>
                            <Text style={st.hourSub}>{`${Math.round(h.rainChance)}% rain`}</Text>
                            <Text style={st.hourSub}>{`${Math.round(h.windMph)} mph`}</Text>
                            {h.gustMph != null ? <Text style={st.hourSub}>{`Gust ${Math.round(h.gustMph)}`}</Text> : null}
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                  <Attribution updated={formatUpdated(w.updatedAt, w.timezone)} />
                  <Pressable accessibilityRole="link" onPress={() => open("https://www.mwis.org.uk/")} style={st.mwis}>
                    <Text style={st.body}>For UK hills, the Mountain Weather Information Service publishes specialist mountain forecasts for UK mountain areas. It does not cover other countries.</Text>
                    <Text style={st.link}>mwis.org.uk</Text>
                  </Pressable>
                </>
              ) : <Text style={st.body}>Weather is unavailable.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={st.stat}><Text style={st.statVal}>{value}</Text><Text style={st.statLbl}>{label}</Text></View>;
}

function Attribution({ updated }: { updated: string }) {
  return (
    <View style={st.attr}>
      <Pressable accessibilityRole="link" onPress={() => open("https://www.weatherapi.com/")} style={st.attrLink}>
        <Text style={st.link}>Weather data by WeatherAPI.com</Text>
      </Pressable>
      <Text style={st.small}>{`Updated ${updated}`}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { marginHorizontal: SP.gutter, marginTop: SP.stack, padding: SP.lg, gap: 10, borderRadius: RADIUS.md,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { ...TYPE.eyebrow, color: BASECAMP.textDim },
  label: { ...TYPE.small, color: BASECAMP.textMuted },
  body: { ...TYPE.body, color: BASECAMP.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  temp: { ...TYPE.metric, color: BASECAMP.text },
  cond: { ...TYPE.bodyBold, color: BASECAMP.textStrong, flexShrink: 1 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexGrow: 1, minWidth: 70, padding: 8, borderRadius: RADIUS.sm, backgroundColor: BASECAMP.panelSub },
  statVal: { ...TYPE.bodyBold, color: BASECAMP.text },
  statLbl: { ...TYPE.caption, color: BASECAMP.textDim },
  notice: { ...TYPE.small, color: EXPLORE.unverified },
  more: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moreText: { ...TYPE.bodyBold, color: EXPLORE.accent },
  btn: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 16, borderRadius: RADIUS.sm, backgroundColor: EXPLORE.accent },
  btnText: { ...TYPE.bodyBold, color: EXPLORE.accentInk },
  skel: { borderRadius: 6, backgroundColor: BASECAMP.hairline },
  attr: { gap: 2 },
  attrLink: { minHeight: 44, justifyContent: "center" },
  link: { ...TYPE.smallBold, color: EXPLORE.accent, textDecorationLine: "underline" },
  small: { ...TYPE.caption, color: BASECAMP.textDim },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "88%", padding: SP.lg, gap: 12, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    backgroundColor: BASECAMP.ink, borderWidth: 1, borderColor: BASECAMP.panelBorder },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { ...TYPE.heading, color: BASECAMP.text },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dayChip: { minWidth: 92, minHeight: 64, padding: 10, borderRadius: RADIUS.sm, backgroundColor: BASECAMP.panelSub,
    borderWidth: 1, borderColor: BASECAMP.panelSubBorder, gap: 2 },
  dayChipOn: { borderColor: EXPLORE.accentLine, backgroundColor: EXPLORE.accentDim },
  dayName: { ...TYPE.smallBold, color: BASECAMP.textMuted },
  dayTemp: { ...TYPE.bodyBold, color: BASECAMP.textStrong },
  dayRain: { ...TYPE.caption, color: BASECAMP.textDim },
  hour: { width: 78, padding: 8, borderRadius: RADIUS.sm, backgroundColor: BASECAMP.panelSub, gap: 2, alignItems: "center" },
  hourNow: { borderWidth: 1, borderColor: EXPLORE.accentLine, backgroundColor: EXPLORE.accentDim },
  hourTime: { ...TYPE.smallBold, color: BASECAMP.textMuted },
  hourTemp: { ...TYPE.heading, color: BASECAMP.text },
  hourSub: { ...TYPE.caption, color: BASECAMP.textDim },
  mwis: { minHeight: 44, gap: 4 },
});
