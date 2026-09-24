/**
 * Training Basecamp presentation adapter.
 *
 * The approved prototype composes a target mountain, a target date, a mission,
 * a queue of upcoming sessions and a weekly progression strip. Production owns
 * all of those values already — in the summit goal, the Training Plan and the
 * completed-session map. This module is the seam between them.
 *
 * It CALCULATES NOTHING that an engine owns:
 *   · it does not score readiness,
 *   · it does not compute elevation credit,
 *   · it does not decide which session comes next beyond reading the plan's
 *     own order and the completion map the app already persists.
 *
 * Where production has no value, these functions return null and the screen
 * omits that row. A missing number never becomes a zero, and no example figure
 * from the prototype (a mountain, a date, an elevation, a percentage) appears
 * anywhere in this file.
 */

/** The subset of `PlanSession` this adapter reads. */
export interface BasecampSessionLike {
  id?: string;
  type?: string;
  label?: string | null;
  description?: string | null;
  targetElevation?: number | null;
  duration?: string | null;
}

/** The subset of `TrainingWeek` this adapter reads. */
export interface BasecampWeekLike {
  weekNumber: number;
  phase?: string;
  purpose?: string;
  sessions: BasecampSessionLike[];
}

/** Stable key for a plan session, matching how the app already persists them. */
export function planSessionKey(
  week: BasecampWeekLike,
  session: BasecampSessionLike,
  index: number,
): string {
  return session.id ?? `${week.weekNumber}-${index}`;
}

/* ── Target date ────────────────────────────────────────────────────────── */

export interface TargetDateDisplay {
  /** Formatted summit date, e.g. "12 Jul 2027". */
  label: string;
  /** Whole days from `now` to the target. Never negative; null if undated. */
  daysRemaining: number | null;
  /** True once the target date has passed. */
  past: boolean;
}

const DAY_MS = 86_400_000;

/**
 * Formats the summit goal's own date. `now` is injectable so the countdown is
 * testable — production passes nothing and gets today.
 */
export function targetDateDisplay(
  summitDate: string | null | undefined,
  now: Date = new Date(),
): TargetDateDisplay | null {
  if (!summitDate) return null;
  /* Midday avoids the date shifting under a timezone offset, which is how the
     rest of the app already parses this field. */
  const target = new Date(`${summitDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const label = target.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const startOfToday = new Date(now);
  startOfToday.setHours(12, 0, 0, 0);
  const diff = Math.round((target.getTime() - startOfToday.getTime()) / DAY_MS);

  return { label, daysRemaining: Math.max(0, diff), past: diff < 0 };
}

/* ── Objective metrics ──────────────────────────────────────────────────── */

export interface ObjectiveMetric {
  key: string;
  value: string;
  label: string;
}

export interface ObjectiveMetricsInput {
  elevationGain?: number | null;
  distance?: number | null;
  highestAltitude?: number | null;
}

/**
 * The real mountain/route figures the goal carries, formatted for the hero's
 * metric line. A field that is absent or non-positive is omitted rather than
 * rendered as "0 m" — the prototype's row is a statement of fact about the
 * objective, and a zero would be a false one.
 */
export function objectiveMetrics(goal: ObjectiveMetricsInput | null | undefined): ObjectiveMetric[] {
  if (!goal) return [];
  const out: ObjectiveMetric[] = [];
  const add = (key: string, raw: unknown, format: (n: number) => string, label: string) => {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return;
    out.push({ key, value: format(raw), label });
  };
  add("altitude", goal.highestAltitude, n => `${Math.round(n).toLocaleString()} m`, "Summit");
  add("ascent", goal.elevationGain, n => `${Math.round(n).toLocaleString()} m`, "Ascent");
  add("distance", goal.distance, n => `${Number(n.toFixed(1))} km`, "Distance");
  return out;
}

/* ── Mission and Up Next ────────────────────────────────────────────────── */

export interface QueuedSession {
  /** Persistence key — also the React key. */
  key: string;
  /** Week number the session belongs to. */
  weekNumber: number;
  /** Index within that week, which `/session-detail` expects. */
  sessionIndex: number;
  /** "Week 3 · Session 2" — derived from the plan's own numbering. */
  weekLabel: string;
  title: string;
  description: string | null;
  type: string | null;
  /** Target ascent in metres, when the plan prescribes one. */
  elevationM: number | null;
  /** The plan's own duration string. */
  duration: string | null;
}

function toQueued(week: BasecampWeekLike, session: BasecampSessionLike, index: number): QueuedSession {
  const elev = session.targetElevation;
  return {
    key: planSessionKey(week, session, index),
    weekNumber: week.weekNumber,
    sessionIndex: index,
    weekLabel: `Week ${week.weekNumber} · Session ${index + 1}`,
    title: session.label?.trim() || "Training session",
    description: session.description?.trim() || null,
    type: session.type ?? null,
    elevationM:
      typeof elev === "number" && Number.isFinite(elev) && elev > 0 ? Math.round(elev) : null,
    duration: session.duration?.trim() || null,
  };
}

/**
 * Every session in the plan that has not been completed, in plan order.
 *
 * This reads the SAME completion map the rest of the app writes, so Basecamp's
 * idea of "next" cannot drift from the Training Plan's.
 */
export function pendingSessions(
  plan: readonly BasecampWeekLike[] | null | undefined,
  completed: Record<string, boolean> | null | undefined,
  fromWeekNumber?: number | null,
): QueuedSession[] {
  if (!plan?.length) return [];
  const done = completed ?? {};
  const out: QueuedSession[] = [];
  for (const week of plan) {
    if (typeof fromWeekNumber === "number" && week.weekNumber < fromWeekNumber) continue;
    week.sessions?.forEach((session, index) => {
      if (done[planSessionKey(week, session, index)]) return;
      out.push(toQueued(week, session, index));
    });
  }
  return out;
}

export interface MissionQueue {
  /** The session to act on now. Null when the plan is complete or absent. */
  mission: QueuedSession | null;
  /** What follows it, for the Up Next rail. */
  upNext: QueuedSession[];
}

/** Splits the pending queue into the mission and the rail behind it. */
export function missionQueue(
  plan: readonly BasecampWeekLike[] | null | undefined,
  completed: Record<string, boolean> | null | undefined,
  options: { fromWeekNumber?: number | null; upNextLimit?: number } = {},
): MissionQueue {
  const limit = options.upNextLimit ?? 4;
  const pending = pendingSessions(plan, completed, options.fromWeekNumber);
  return { mission: pending[0] ?? null, upNext: pending.slice(1, 1 + limit) };
}

/* ── Weekly progression ─────────────────────────────────────────────────── */

export interface WeekBar {
  key: string;
  /** Short label under the bar — the session's position in the week. */
  label: string;
  title: string;
  /** 0–1, relative to the heaviest prescribed session in this week. */
  load: number;
  done: boolean;
}

export interface WeekProgress {
  weekNumber: number;
  phase: string | null;
  completed: number;
  total: number;
  /** Whole-percent completion of this week's prescribed sessions. */
  percent: number;
  bars: WeekBar[];
}

/** Bars with no prescribed ascent still need a visible floor. */
const MIN_BAR_LOAD = 0.34;

/**
 * The current week's progression.
 *
 * Bar heights come from each session's own `targetElevation`, normalised
 * against the heaviest session in that week — so the strip describes the
 * plan the user actually has rather than a fixed shape. Sessions the plan
 * prescribes no ascent for (indoor cardio, strength) sit at a floor height
 * instead of collapsing to nothing.
 */
export function weekProgress(
  week: BasecampWeekLike | null | undefined,
  completed: Record<string, boolean> | null | undefined,
): WeekProgress | null {
  if (!week?.sessions?.length) return null;
  const done = completed ?? {};

  const loads = week.sessions.map(s =>
    typeof s.targetElevation === "number" && Number.isFinite(s.targetElevation) && s.targetElevation > 0
      ? s.targetElevation
      : 0);
  const peak = Math.max(...loads);

  const bars: WeekBar[] = week.sessions.map((session, index) => {
    const raw = loads[index];
    const normalised = peak > 0 && raw > 0 ? raw / peak : 0;
    return {
      key: planSessionKey(week, session, index),
      label: String(index + 1),
      title: session.label?.trim() || "Training session",
      load: Math.max(MIN_BAR_LOAD, normalised),
      done: Boolean(done[planSessionKey(week, session, index)]),
    };
  });

  const completedCount = bars.filter(b => b.done).length;
  return {
    weekNumber: week.weekNumber,
    phase: week.phase?.trim() || null,
    completed: completedCount,
    total: bars.length,
    percent: bars.length === 0 ? 0 : Math.round((completedCount / bars.length) * 100),
    bars,
  };
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** Metres, grouped. Null in, null out — callers omit the row. */
export function formatMetres(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString()} m`;
}

/**
 * The short facts line under a session title, built only from what the plan
 * supplied. Returns an empty array when it supplied nothing.
 */
export function sessionFacts(session: Pick<QueuedSession, "elevationM" | "duration">): string[] {
  const facts: string[] = [];
  const elev = formatMetres(session.elevationM);
  if (elev) facts.push(`${elev} gain`);
  if (session.duration) facts.push(session.duration);
  return facts;
}


/* ── The training week, in dates ─────────────────────────────────────────── */

/**
 * "5 – 11 Nov" for a plan week, from the week's own start and end dates.
 *
 * WHY THIS MATTERS: a plan can legitimately sit well before its target date.
 * The plan engine starts an eight-week block eight weeks before the summit
 * when there is more time than the block needs, so "WEEK 1 OF 8" beside "109
 * days to target" is correct — it just looks like a contradiction until the
 * screen says WHEN week 1 actually is. Nothing here changes the engine; it
 * reads the dates the engine already produced.
 */
export function weekDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  if (!end || Number.isNaN(end.getTime())) return null;

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-GB",
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${startLabel} – ${endLabel}`;
}

/**
 * How long until a plan week begins, when it has not begun yet.
 *
 * Returns null once the week has started, so the screen says nothing rather
 * than counting down to a date that has passed.
 */
export function weeksUntilPlanStart(
  firstWeekStart: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!firstWeekStart) return null;
  const start = new Date(firstWeekStart);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.ceil((start.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return null;
  return Math.max(1, Math.round(days / 7));
}

export interface PlanWeekDay {
  /** JavaScript day of week, 0 = Sunday — the key the plan maps sessions by. */
  dow: number;
  /** Calendar date number, or null when the week carries no usable date. */
  date: number | null;
  /** True for today, so the strip can mark it without guessing. */
  isToday: boolean;
}

/**
 * The seven days of a plan week, in the week's OWN order.
 *
 * A plan week does not necessarily begin on a Monday: the engine starts a
 * block a whole number of weeks before the target date, which can land on any
 * weekday. Laying the strip out Monday-to-Sunday therefore showed dates in the
 * wrong order — 28, 29, 30, 24, 25, 26, 27 for a week beginning on a Thursday.
 * These are the week's real consecutive days.
 *
 * With no usable start date it falls back to Monday-first with no numbers,
 * which is what the strip showed before dates existed.
 */
export function planWeekDays(
  weekStart: string | null | undefined,
  now: Date = new Date(),
): PlanWeekDay[] {
  const todayDow = now.getDay();
  const todayDate = now.getDate();
  const start = weekStart ? new Date(weekStart) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return [1, 2, 3, 4, 5, 6, 0].map(dow => ({
      dow, date: null, isToday: dow === todayDow,
    }));
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const cell = new Date(start.getTime() + offset * DAY_MS);
    return {
      dow: cell.getDay(),
      date: cell.getDate(),
      isToday: cell.getDate() === todayDate
        && cell.getMonth() === now.getMonth()
        && cell.getFullYear() === now.getFullYear(),
    };
  });
}
