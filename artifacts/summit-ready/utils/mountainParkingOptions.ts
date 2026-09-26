import type { MountainLookupResponse } from "./mountainDetailPresentation";

export type MountainParkingOption = {
  id: string;
  name: string;
  approach: string;
  osGridReference: string;
  postcode: string;
  note: string;
  sourceName: string;
  sourceUrl: string;
  mapSearch: string;
};

/** Published car parks, not verified walking-route starts or vehicle-entrance pins. */
const sourcedParkingByMountain: Record<string, readonly MountainParkingOption[]> = {
  "dobih:2367": [
    {
      id: "lake-head",
      name: "Lake Head car park",
      approach: "Wasdale approach",
      osGridReference: "NY182075",
      postcode: "CA20 1EX",
      note: "National Trust car park at the head of Wastwater. Check your chosen walking route starts in Wasdale.",
      sourceName: "National Trust",
      sourceUrl: "https://www.nationaltrust.org.uk/visit/lake-district/wasdale/car-parks-in-wasdale",
      mapSearch: "Lake Head National Trust car park, Wasdale Head, CA20 1EX",
    },
    {
      id: "honister-pass",
      name: "Honister Pass car park",
      approach: "Honister approach",
      osGridReference: "NY225135",
      postcode: "CA12 5XN",
      note: "National Trust car park on Honister Pass. A Great Gable walk from Honister is described by the local operator.",
      sourceName: "National Trust",
      sourceUrl: "https://www.nationaltrust.org.uk/visit/lake-district/borrowdale-and-derwent-water/car-parks-in-borrowdale-and-derwent-water",
      mapSearch: "National Trust Honister Pass car park, CA12 5XN",
    },
    {
      id: "seatoller",
      name: "Seatoller car park",
      approach: "Borrowdale / Seathwaite approach",
      osGridReference: "NY246137",
      postcode: "CA12 5XN",
      note: "National Trust alternative to roadside parking at Seathwaite; allow for the extra walk to the trailhead.",
      sourceName: "National Trust",
      sourceUrl: "https://www.nationaltrust.org.uk/visit/lake-district/borrowdale-and-derwent-water/car-parks-in-borrowdale-and-derwent-water",
      mapSearch: "Seatoller National Trust car park, Borrowdale, CA12 5XN",
    },
  ],
};

/** Never match an unverified search result or a mountain with the same name. */
export function sourcedParkingOptionsForMountain(
  lookup: MountainLookupResponse | null,
): readonly MountainParkingOption[] {
  if (lookup?.source !== "canonical" || lookup.trustedFacts?.verificationStatus !== "verified") return [];
  return sourcedParkingByMountain[lookup.canonicalIdentity?.canonicalSourceKey ?? ""] ?? [];
}