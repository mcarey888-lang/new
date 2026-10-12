export type ActivityAudience = "public" | "followers" | "private";
/** Public means signed-in SummitReady members, not anonymous website visitors. */
export function canReadActivity({owner,viewer,audience,follows}: {owner:string;viewer:string|null;audience:ActivityAudience|null;follows:boolean}) {
  return !!viewer && (owner === viewer || audience === "public" || (audience === "followers" && follows));
}
