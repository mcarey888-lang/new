import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckCircle, ChevronDown, ChevronRight } from "lucide-react-native";
import {
  WAINWRIGHTS,
  WAINWRIGHT_BOOK_NAMES,
  WAINWRIGHT_STORAGE_KEY,
  type WainwrightFell,
} from "@/constants/wainwrights";
import { useChallenges } from "@/context/ChallengesContext";
import { T } from "@/constants/theme";

const BOOKS = [1, 2, 3, 4, 5, 6, 7] as const;

interface Props {
  challengeId: string;
  color: string;
  isActive: boolean;
}

export function WainwrightTickList({ challengeId, color, isActive }: Props) {
  const { logActivityOnly, getActiveChallenge } = useChallenges();
  const [tickedIds, setTickedIds] = useState<Set<string>>(new Set());
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [ticking, setTicking] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(WAINWRIGHT_STORAGE_KEY).then(raw => {
      if (raw) setTickedIds(new Set(JSON.parse(raw) as string[]));
      setLoading(false);
    });
  }, []);

  const bookFells = useMemo(() => {
    const map = new Map<number, WainwrightFell[]>();
    for (const b of BOOKS) map.set(b, WAINWRIGHTS.filter(f => f.book === b));
    return map;
  }, []);

  function toggleBook(book: number) {
    setExpandedBooks(prev => {
      const next = new Set(prev);
      if (next.has(book)) next.delete(book); else next.add(book);
      return next;
    });
  }

  const handleTick = useCallback(async (fell: WainwrightFell) => {
    if (tickedIds.has(fell.id) || ticking.has(fell.id)) return;
    setTicking(prev => new Set(prev).add(fell.id));
    try {
      const next = new Set(tickedIds);
      next.add(fell.id);
      setTickedIds(next);
      await AsyncStorage.setItem(WAINWRIGHT_STORAGE_KEY, JSON.stringify([...next]));
      const ac = getActiveChallenge(challengeId);
      if (ac && !ac.completed) {
        await logActivityOnly({
          challengeId,
          title: fell.name,
          date: new Date().toISOString().split("T")[0],
          elevationGain: fell.elevationGain,
          distance: 0,
          duration: 0,
          notes: `Wainwright fell: ${fell.name} (${fell.summitElevation}m)`,
        });
      }
    } finally {
      setTicking(prev => { const s = new Set(prev); s.delete(fell.id); return s; });
    }
  }, [tickedIds, ticking, challengeId, logActivityOnly, getActiveChallenge]);

  if (loading) {
    return (
      <View style={wt.loadRow}>
        <ActivityIndicator color={color} size="small" />
        <Text style={wt.loadText}>Loading tick list…</Text>
      </View>
    );
  }

  const totalTicked = tickedIds.size;
  const pct = Math.round((totalTicked / 214) * 100);

  return (
    <View style={wt.container}>
      <View style={wt.headerRow}>
        <Text style={wt.headerTitle}>WAINWRIGHT TICK LIST</Text>
        <View style={[wt.badge, { backgroundColor: color + "22" }]}>
          <Text style={[wt.badgeText, { color }]}>{totalTicked} / 214</Text>
        </View>
      </View>

      <View style={wt.progressTrack}>
        <View style={[wt.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>

      {BOOKS.map(book => {
        const fells = bookFells.get(book) ?? [];
        const bookTicked = fells.filter(f => tickedIds.has(f.id)).length;
        const expanded = expandedBooks.has(book);
        const allDone = bookTicked === fells.length;

        return (
          <View key={book} style={wt.bookWrap}>
            <TouchableOpacity onPress={() => toggleBook(book)} activeOpacity={0.72} style={wt.bookRow}>
              {expanded
                ? <ChevronDown size={14} color={T.textMuted} />
                : <ChevronRight size={14} color={T.textMuted} />}
              <Text style={wt.bookName}>{WAINWRIGHT_BOOK_NAMES[book]}</Text>
              <View style={[wt.bookBadge, allDone && { backgroundColor: color + "22" }]}>
                <Text style={[wt.bookBadgeText, allDone && { color }]}>
                  {bookTicked}/{fells.length}
                </Text>
              </View>
            </TouchableOpacity>

            {expanded && (
              <View style={wt.fellList}>
                {fells.map((fell, idx) => {
                  const done = tickedIds.has(fell.id);
                  const busy = ticking.has(fell.id);
                  return (
                    <React.Fragment key={fell.id}>
                      {idx > 0 && <View style={wt.divider} />}
                      <TouchableOpacity
                        onPress={() => !done && isActive && handleTick(fell)}
                        activeOpacity={done || !isActive ? 1 : 0.65}
                        style={wt.fellRow}
                      >
                        <View style={wt.checkWrap}>
                          {busy ? (
                            <ActivityIndicator size="small" color={color} />
                          ) : done ? (
                            <CheckCircle size={20} color={color} />
                          ) : (
                            <View style={[
                              wt.emptyCircle,
                              { borderColor: isActive ? T.textMuted : T.border },
                            ]} />
                          )}
                        </View>
                        <Text
                          style={[wt.fellName, done && wt.fellNameDone]}
                          numberOfLines={1}
                        >
                          {fell.name}
                        </Text>
                        <Text style={[wt.fellElev, done && { color: T.textDim }]}>
                          {fell.summitElevation}m
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {!isActive && (
        <Text style={wt.inactiveHint}>Start the challenge to begin ticking fells.</Text>
      )}
    </View>
  );
}

const wt = StyleSheet.create({
  container: {
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1, borderColor: T.border,
    overflow: "hidden",
  },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  loadText: { fontSize: 13, fontFamily: "Inter_400Regular", color: T.textMuted },

  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  headerTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: T.textMuted, letterSpacing: 1.4 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  progressTrack: { height: 3, backgroundColor: T.border, marginHorizontal: 16, marginBottom: 10, borderRadius: 2 },
  progressFill: { height: 3, borderRadius: 2 },

  bookWrap: { borderTopWidth: 1, borderTopColor: T.border },
  bookRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  bookName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: T.text },
  bookBadge: { backgroundColor: T.surface, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  bookBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: T.textMuted },

  fellList: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 2 },
  divider: { height: 1, backgroundColor: T.border },
  fellRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  checkWrap: { width: 24, alignItems: "center" },
  emptyCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  fellName: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: T.text },
  fellNameDone: { color: T.textMuted },
  fellElev: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: T.textDim },

  inactiveHint: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: T.textMuted,
    textAlign: "center", paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: T.border,
  },
});
