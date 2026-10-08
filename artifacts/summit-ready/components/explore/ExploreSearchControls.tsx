/**
 * Explore Filters / Sort by controls. Draft state lives here; the screen only
 * receives validated values through onApply / onReset.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowUpDown, Check, SlidersHorizontal, X } from "lucide-react-native";
import { BASECAMP, EXPLORE, HIT, RADIUS, SP, TYPE } from "@/constants/tokens";
import {
  DEFAULT_EXPLORE_FILTERS, EXPLORE_SORT_LABELS, activeExploreFilterCount,
  type ExploreFilters, type ExploreSort,
} from "@/utils/exploreFilters";

type Props = {
  filters: ExploreFilters;
  sort: ExploreSort;
  onApply: (filters: ExploreFilters, sort: ExploreSort) => void;
  onReset: () => void;
};

const KINDS: { id: ExploreFilters["kind"]; label: string }[] = [
  { id: "all", label: "Mountains and routes" },
  { id: "mountains", label: "Mountains only" },
  { id: "routes", label: "Routes only" },
];
const DIFFS: ExploreFilters["difficulty"][] = ["any", "Easy", "Moderate", "Hard"];
const SORTS = Object.keys(EXPLORE_SORT_LABELS) as ExploreSort[];

type Range = { label: string; min: number | null; max: number | null };
const SUMMIT_PRESETS: Range[] = [
  { label: "200 m+", min: 200, max: null },
  { label: "600 m+", min: 600, max: null },
  { label: "1,000 m+", min: 1000, max: null },
];
const ASCENT_PRESETS: Range[] = [
  { label: "Up to 500 m", min: null, max: 500 },
  { label: "500 to 900 m", min: 500, max: 900 },
  { label: "900 m+", min: 900, max: null },
];
const TIME_PRESETS: Range[] = [
  { label: "Up to 3 h", min: null, max: 3 },
  { label: "3 to 6 h", min: 3, max: 6 },
  { label: "6 h+", min: 6, max: null },
];

const str = (n: number | null) => (n == null ? "" : String(n));
const hoursStr = (m: number | null) => (m == null ? "" : String(Math.round((m / 60) * 100) / 100));

function parse(label: string, v: string): { value: number | null; error?: string } {
  const t = v.trim();
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { value: null, error: `${label}: enter a number of zero or more.` };
  return { value: n };
}

export function describeExploreFilters(f: ExploreFilters): string[] {
  const out: string[] = [];
  const range = (name: string, lo: number | null, hi: number | null, unit: string, fmt = (n: number) => n.toLocaleString()) => {
    if (lo == null && hi == null) return;
    out.push(lo != null && hi != null ? `${name} ${fmt(lo)} to ${fmt(hi)} ${unit}`
      : lo != null ? `${name} ${fmt(lo)} ${unit}+` : `${name} up to ${fmt(hi as number)} ${unit}`);
  };
  if (f.kind === "mountains") out.push("Mountains only");
  if (f.kind === "routes") out.push("Routes only");
  if (f.difficulty !== "any") out.push(`Route difficulty ${f.difficulty}`);
  range("Summit height", f.summitMinM, f.summitMaxM, "m");
  range("Route ascent", f.ascentMinM, f.ascentMaxM, "m");
  range("Route time", f.timeMinMinutes, f.timeMaxMinutes, "h", n => String(Math.round((n / 60) * 100) / 100));
  return out;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[s.chip, on && s.chipOn]}
    >
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function RangeInputs({ label, unit, min, max, setMin, setMax, presets, apply, note }: {
  label: string; unit: string; min: string; max: string;
  setMin: (v: string) => void; setMax: (v: string) => void;
  presets: Range[]; apply: (r: Range) => void; note: string;
}) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{label}</Text>
      <Text style={s.note}>{note}</Text>
      <View style={s.rangeRow}>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input} value={min} onChangeText={setMin} keyboardType="decimal-pad"
            placeholder="Min" placeholderTextColor={BASECAMP.textDim}
            accessibilityLabel={`${label} minimum in ${unit === "h" ? "hours" : "metres"}`}
          />
          <Text style={s.unit}>{unit}</Text>
        </View>
        <Text style={s.to}>to</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input} value={max} onChangeText={setMax} keyboardType="decimal-pad"
            placeholder="Max" placeholderTextColor={BASECAMP.textDim}
            accessibilityLabel={`${label} maximum in ${unit === "h" ? "hours" : "metres"}`}
          />
          <Text style={s.unit}>{unit}</Text>
        </View>
      </View>
      <View style={s.wrap}>
        {presets.map(p => <Chip key={p.label} label={p.label} on={false} onPress={() => apply(p)} />)}
      </View>
    </View>
  );
}

export function ExploreSearchControls({ filters, sort, onApply, onReset }: Props) {
  const [panel, setPanel] = useState<"filters" | "sort" | null>(null);
  const [kind, setKind] = useState(filters.kind);
  const [diff, setDiff] = useState(filters.difficulty);
  const [sMin, setSMin] = useState("");
  const [sMax, setSMax] = useState("");
  const [aMin, setAMin] = useState("");
  const [aMax, setAMax] = useState("");
  const [tMin, setTMin] = useState("");
  const [tMax, setTMax] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const count = activeExploreFilterCount(filters);
  const summary = describeExploreFilters(filters);

  const load = (f: ExploreFilters) => {
    setKind(f.kind); setDiff(f.difficulty);
    setSMin(str(f.summitMinM)); setSMax(str(f.summitMaxM));
    setAMin(str(f.ascentMinM)); setAMax(str(f.ascentMaxM));
    setTMin(hoursStr(f.timeMinMinutes)); setTMax(hoursStr(f.timeMaxMinutes));
    setErrors([]);
  };

  const openFilters = () => {
    if (panel === "filters") { setPanel(null); return; }
    load(filters);
    setPanel("filters");
  };

  const apply = () => {
    const errs: string[] = [];
    const pairs = [
      ["Summit height", sMin, sMax], ["Route ascent", aMin, aMax], ["Route time", tMin, tMax],
    ] as const;
    const parsed = pairs.map(([label, lo, hi]) => {
      const a = parse(`${label} minimum`, lo);
      const b = parse(`${label} maximum`, hi);
      if (a.error) errs.push(a.error);
      if (b.error) errs.push(b.error);
      if (!a.error && !b.error && a.value != null && b.value != null && a.value > b.value) {
        errs.push(`${label}: the minimum is higher than the maximum.`);
      }
      return [a.value, b.value] as const;
    });
    if (parsed[0].some(value => value != null && value > 10000)) {
      errs.push("Summit height: enter a value no higher than 10,000 metres.");
    }
    if (errs.length) { setErrors(errs); return; }
    onApply({
      kind, difficulty: diff,
      summitMinM: parsed[0][0], summitMaxM: parsed[0][1],
      ascentMinM: parsed[1][0], ascentMaxM: parsed[1][1],
      timeMinMinutes: parsed[2][0] == null ? null : Math.round(parsed[2][0] * 60),
      timeMaxMinutes: parsed[2][1] == null ? null : Math.round(parsed[2][1] * 60),
    }, sort);
    setPanel(null);
  };

  const reset = () => { load(DEFAULT_EXPLORE_FILTERS); onReset(); setPanel(null); };
  const sortChanged = sort !== "recommended";

  return (
    <View style={s.root}>
      <View style={s.bar}>
        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={count ? `Filters, ${count} active` : "Filters"}
          accessibilityState={{ expanded: panel === "filters" }}
          style={[s.barBtn, (panel === "filters" || count > 0) && s.barBtnOn]}
          testID="explore-filters-button"
        >
          <SlidersHorizontal size={16} color={count > 0 ? EXPLORE.accent : BASECAMP.textStrong} />
          <Text style={s.barText}>Filters{count ? ` (${count})` : ""}</Text>
        </Pressable>
        <Pressable
          onPress={() => setPanel(panel === "sort" ? null : "sort")}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${EXPLORE_SORT_LABELS[sort]}`}
          accessibilityState={{ expanded: panel === "sort" }}
          style={[s.barBtn, (panel === "sort" || sortChanged) && s.barBtnOn]}
          testID="explore-sort-button"
        >
          <ArrowUpDown size={16} color={sortChanged ? EXPLORE.accent : BASECAMP.textStrong} />
          <Text style={s.barText} numberOfLines={1}>Sort by: {EXPLORE_SORT_LABELS[sort]}</Text>
        </Pressable>
      </View>

      {summary.length > 0 || sortChanged ? (
        <View style={s.summaryRow}>
          <Text style={s.summaryText} numberOfLines={3}>
            {[...summary, ...(sortChanged ? [`Sorted by ${EXPLORE_SORT_LABELS[sort]}`] : [])].join("  ·  ")}
          </Text>
          <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="Reset filters and sort" hitSlop={HIT.slop}>
            <Text style={s.resetLink}>Reset</Text>
          </Pressable>
        </View>
      ) : null}

      {panel === "sort" ? (
        <View style={s.panel}>
          <Text style={s.groupTitle}>Sort by</Text>
          <Text style={s.note}>Time, ascent and difficulty sort routes. Summit height sorts mountains.</Text>
          {SORTS.map(id => (
            <Pressable
              key={id}
              onPress={() => { onApply(filters, id); setPanel(null); }}
              accessibilityRole="button"
              accessibilityState={{ selected: id === sort }}
              style={s.sortRow}
            >
              <Text style={[s.sortText, id === sort && { color: EXPLORE.accent }]}>{EXPLORE_SORT_LABELS[id]}</Text>
              {id === sort ? <Check size={16} color={EXPLORE.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {panel === "filters" ? (
        <View style={s.panel}>
          <View style={s.panelHead}>
            <Text style={s.panelTitle}>Filters</Text>
            <Pressable onPress={() => setPanel(null)} accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={HIT.slop}>
              <X size={18} color={BASECAMP.textMuted} />
            </Pressable>
          </View>

          <View style={s.group}>
            <Text style={s.groupTitle}>Show</Text>
            <View style={s.wrap}>
              {KINDS.map(k => <Chip key={k.id} label={k.label} on={kind === k.id} onPress={() => setKind(k.id)} />)}
            </View>
          </View>

          <RangeInputs
            label="Summit height" unit="m" min={sMin} max={sMax} setMin={setSMin} setMax={setSMax}
            presets={SUMMIT_PRESETS} apply={r => { setSMin(str(r.min)); setSMax(str(r.max)); }}
            note="Height of the mountain itself. Applies to mountain results."
          />

          <View style={s.group}>
            <Text style={s.groupTitle}>Route difficulty</Text>
            <Text style={s.note}>Applies to routes only.</Text>
            <View style={s.wrap}>
              {DIFFS.map(d => <Chip key={d} label={d === "any" ? "Any" : d} on={diff === d} onPress={() => setDiff(d)} />)}
            </View>
          </View>

          <RangeInputs
            label="Route ascent" unit="m" min={aMin} max={aMax} setMin={setAMin} setMax={setAMax}
            presets={ASCENT_PRESETS} apply={r => { setAMin(str(r.min)); setAMax(str(r.max)); }}
            note="Total climbing on the route, not the summit height."
          />
          <RangeInputs
            label="Estimated route time" unit="h" min={tMin} max={tMax} setMin={setTMin} setMax={setTMax}
            presets={TIME_PRESETS} apply={r => { setTMin(str(r.min)); setTMax(str(r.max)); }}
            note="Hours, for example 2.5. Applies to routes only."
          />

          {errors.length ? (
            <View style={s.errorBox} accessibilityLiveRegion="polite">
              {errors.map(e => <Text key={e} style={s.errorText}>{e}</Text>)}
            </View>
          ) : null}

          <View style={s.actions}>
            <Pressable onPress={reset} accessibilityRole="button" style={s.secondary}>
              <Text style={s.secondaryText}>Reset</Text>
            </Pressable>
            <Pressable onPress={apply} accessibilityRole="button" style={s.primary} testID="explore-filters-apply">
              <Text style={s.primaryText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: BASECAMP.gutter, gap: SP.sm, marginTop: SP.md },
  bar: { flexDirection: "row", gap: SP.sm },
  barBtn: {
    flex: 1, minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingHorizontal: SP.md, borderRadius: RADIUS.md,
    backgroundColor: BASECAMP.glass, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  barBtnOn: { borderColor: EXPLORE.accentLine, backgroundColor: EXPLORE.accentDim },
  barText: { ...TYPE.smallBold, color: BASECAMP.textStrong, flexShrink: 1 },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: SP.md },
  summaryText: { ...TYPE.small, color: BASECAMP.textMuted, flex: 1 },
  resetLink: { ...TYPE.smallBold, color: EXPLORE.accent },
  panel: {
    gap: SP.md, padding: SP.lg, borderRadius: RADIUS.md,
    backgroundColor: "rgba(10,17,19,0.96)", borderWidth: 1, borderColor: BASECAMP.panelBorder,
  },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { ...TYPE.heading, color: BASECAMP.text },
  group: { gap: SP.sm },
  groupTitle: { ...TYPE.bodyBold, color: BASECAMP.text },
  note: { ...TYPE.caption, color: BASECAMP.textDim },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  chip: {
    minHeight: 36, paddingHorizontal: SP.md, justifyContent: "center", borderRadius: RADIUS.pill,
    backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.panelSubBorder,
  },
  chipOn: { backgroundColor: EXPLORE.accentDim, borderColor: EXPLORE.accentLine },
  chipText: { ...TYPE.small, color: BASECAMP.textMuted },
  chipTextOn: { color: BASECAMP.text, fontFamily: "Inter_600SemiBold" },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", minHeight: HIT.minTarget, paddingHorizontal: SP.md,
    borderRadius: RADIUS.sm, backgroundColor: BASECAMP.panelSub, borderWidth: 1, borderColor: BASECAMP.hairline,
  },
  input: { flex: 1, ...TYPE.body, color: BASECAMP.text, paddingVertical: 8 },
  unit: { ...TYPE.small, color: BASECAMP.textDim },
  to: { ...TYPE.small, color: BASECAMP.textDim },
  sortRow: {
    minHeight: HIT.minTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: BASECAMP.hairline,
  },
  sortText: { ...TYPE.body, color: BASECAMP.textStrong },
  errorBox: {
    gap: 4, padding: SP.md, borderRadius: RADIUS.sm,
    backgroundColor: EXPLORE.unverifiedDim, borderWidth: 1, borderColor: EXPLORE.unverifiedLine,
  },
  errorText: { ...TYPE.small, color: EXPLORE.unverified },
  actions: { flexDirection: "row", gap: SP.sm },
  secondary: {
    flex: 1, minHeight: HIT.minTarget, alignItems: "center", justifyContent: "center",
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: BASECAMP.glassBorder,
  },
  secondaryText: { ...TYPE.bodyBold, color: BASECAMP.textStrong },
  primary: {
    flex: 2, minHeight: HIT.minTarget, alignItems: "center", justifyContent: "center",
    borderRadius: RADIUS.md, backgroundColor: EXPLORE.accent,
  },
  primaryText: { ...TYPE.bodyBold, color: EXPLORE.accentInk },
});
