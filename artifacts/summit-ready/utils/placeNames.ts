/**
 * Prefer established English place names where a commonly recognised English
 * equivalent exists. Welsh names without an English equivalent stay unchanged.
 */
export function englishPlaceName(name: string): string {
  return name
    .replace(/\bSnowdon\s*\/\s*Yr Wyddfa\b/gi, "Snowdon")
    .replace(/\bYr Wyddfa\s*\/\s*Snowdon\b/gi, "Snowdon")
    .replace(/\bSnowdon\s*\(\s*Yr Wyddfa\s*\)/gi, "Snowdon")
    .replace(/\bYr Wyddfa\s*\(\s*Snowdon\s*\)/gi, "Snowdon")
    .replace(/\bYr Wyddfa\b/gi, "Snowdon")
    .replace(/\bBannau Brycheiniog\b/gi, "Brecon Beacons")
    .replace(/\bEryri\b/gi, "Snowdonia");
}