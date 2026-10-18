/**
 * The drawn stand-in for a hill with no photograph.
 *
 * There are more than twenty thousand summits in the catalogue and approved
 * artwork for a few dozen. Everything else fell through to a satellite tile
 * centred on the hill, which at thumbnail size is an unreadable green square —
 * so a list of obscure Scottish tops looked like wallpaper, and every row cost
 * a map request to produce it.
 *
 * This draws one instead. Three rules it keeps:
 *
 *   · It is not a photograph and never pretends to be. The shape is flat,
 *     stylised bands, not a profile, because a detailed silhouette would read
 *     as a claim about what that hill actually looks like. Callers label it
 *     the way the app already labels its other illustration.
 *   · The one thing it does state is true. The skyline height and the band
 *     palette come from the hill's RECORDED elevation, so a Munro looks
 *     higher than a moor because it is higher, not because of a random seed.
 *   · The same hill always draws the same. The variation within a band comes
 *     from the name, so a list has texture without a hill changing appearance
 *     between screens or between sessions.
 *
 * A hill with no recorded elevation gets the lowest band and a flatter
 * skyline. That is the honest reading of a missing number: it is not treated
 * as zero, and nothing is invented to fill it.
 */

export interface HillBand {
  /** What the band is called, for the accessibility label. */
  readonly name: string;
  /** Lowest recorded elevation, in metres, that falls in this band. */
  readonly fromM: number;
  readonly sky: readonly [string, string];
  readonly ridge: string;
  /** The far ridge behind the near one, dimmer so the two read as distance. */
  readonly farRidge: string;
  /** Drawn across the top of the highest band only; null elsewhere. */
  readonly cap: string | null;
}

/**
 * Presentation bands, not a classification anyone else uses. The boundaries
 * are round numbers chosen to spread British hills across four looks — a
 * moorland top, a fell, a big hill, and the ground that holds snow. They
 * decide a colour and nothing else: no figure shown to anyone is derived from
 * which band a hill lands in.
 */
export const HILL_BANDS: readonly HillBand[] = [
  {
    name: "low ground",
    fromM: 0,
    sky: ["#16231F", "#0A1114"],
    ridge: "#2C4A3C",
    farRidge: "#1E3329",
    cap: null,
  },
  {
    name: "moorland",
    fromM: 300,
    sky: ["#17262A", "#0A1114"],
    ridge: "#2F4F4B",
    farRidge: "#203733",
    cap: null,
  },
  {
    name: "fell",
    fromM: 600,
    sky: ["#182733", "#0A1114"],
    ridge: "#355061",
    farRidge: "#233743",
    cap: null,
  },
  {
    name: "high ground",
    fromM: 900,
    sky: ["#1B2838", "#0A1114"],
    ridge: "#3E5873",
    farRidge: "#293B4E",
    cap: "#B7C9D6",
  },
] as const;

/** The band a recorded elevation falls in. Missing is the lowest band. */
export function bandFor(elevationM: number | null | undefined): HillBand {
  if (typeof elevationM !== "number" || !Number.isFinite(elevationM)) {
    return HILL_BANDS[0]!;
  }
  let band = HILL_BANDS[0]!;
  for (const candidate of HILL_BANDS) {
    if (elevationM >= candidate.fromM) band = candidate;
  }
  return band;
}

/**
 * A stable number from a name. Not a hash anything depends on — it only has
 * to be the same every time for the same hill, and spread names evenly enough
 * that neighbouring rows in a list differ.
 */
export function nameSeed(name: string): number {
  let seed = 2166136261;
  const subject = name.trim().toLowerCase();
  for (let i = 0; i < subject.length; i++) {
    seed ^= subject.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

export interface HillPlaceholderArt {
  readonly band: HillBand;
  /** Normalised 0..1 across the box, y measured down from the top like SVG. */
  readonly ridge: ReadonlyArray<{ x: number; y: number }>;
  readonly farRidge: ReadonlyArray<{ x: number; y: number }>;
  /** True when the band carries a pale cap along its highest run. */
  readonly capped: boolean;
}

/** Peaks in each drawn ridge. Few, so the shape stays plainly stylised. */
const RIDGE_PEAKS = 3;
const FAR_RIDGE_PEAKS = 2;

/**
 * How far down the box the highest point of the near ridge sits. A hill in the
 * top band reaches SKYLINE_HIGH; one with no recorded elevation sits at
 * SKYLINE_LOW, which is most of the way down.
 */
const SKYLINE_HIGH = 0.22;
const SKYLINE_LOW = 0.62;

function skylineFor(elevationM: number | null | undefined): number {
  if (typeof elevationM !== "number" || !Number.isFinite(elevationM)) return SKYLINE_LOW;
  const top = HILL_BANDS[HILL_BANDS.length - 1]!.fromM;
  const share = Math.max(0, Math.min(1, elevationM / top));
  return SKYLINE_LOW - (SKYLINE_LOW - SKYLINE_HIGH) * share;
}

/** One step of a small deterministic generator, so each peak differs. */
function nextSeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}

function ridgeLine(seed: number, peaks: number, highest: number, base: number):
  Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [{ x: 0, y: base }];
  let s = seed;
  for (let i = 0; i < peaks; i++) {
    s = nextSeed(s);
    /* Each peak reaches somewhere between the skyline and halfway back down
       to the base, so one of them touches the skyline and the others sit
       under it. */
    const drop = ((s >>> 8) % 1000) / 1000;
    const y = highest + (base - highest) * 0.5 * drop;
    const x = (i + 0.5) / peaks;
    points.push({ x, y });
    s = nextSeed(s);
    const saddle = ((s >>> 8) % 1000) / 1000;
    if (i < peaks - 1) {
      points.push({
        x: (i + 1) / peaks,
        y: highest + (base - highest) * (0.55 + 0.4 * saddle),
      });
    }
  }
  points.push({ x: 1, y: base });
  return points;
}

export function hillPlaceholderArt(
  name: string,
  elevationM?: number | null,
): HillPlaceholderArt {
  const band = bandFor(elevationM);
  const seed = nameSeed(name);
  const skyline = skylineFor(elevationM);
  return {
    band,
    /* The far ridge is lower and flatter, which is what makes the near one
       read as nearer. It is drawn first and never carries the cap. */
    farRidge: ridgeLine(nextSeed(seed), FAR_RIDGE_PEAKS, skyline + 0.14, 1),
    ridge: ridgeLine(seed, RIDGE_PEAKS, skyline, 1),
    capped: band.cap !== null,
  };
}

/** A closed path for one ridge, scaled into a box. */
export function ridgePath(
  points: ReadonlyArray<{ x: number; y: number }>,
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const line = points
    .map((p, i) =>
      `${i === 0 ? "M" : "L"}${(p.x * width).toFixed(1)} ${(p.y * height).toFixed(1)}`)
    .join(" ");
  return `${line} L${width.toFixed(1)} ${height.toFixed(1)} L0.0 ${height.toFixed(1)} Z`;
}

/**
 * What a screen reader is told. It says the image is drawn, because a blind
 * user has no other way to know this is not a picture of the hill.
 */
export function placeholderLabel(name: string, elevationM?: number | null): string {
  const where = typeof elevationM === "number" && Number.isFinite(elevationM)
    ? `, ${Math.round(elevationM).toLocaleString()} metres`
    : "";
  return `Illustration standing in for a photograph of ${name}${where}.`;
}
