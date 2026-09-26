/** Treat only complete UK postcodes as location searches; the server validates the actual location. */
export function normalizeUkPostcode(input: string): string | null {
  const compact = input.replace(/\s+/g, "").toUpperCase();
  if (compact === "GIR0AA") return "GIR 0AA";
  const match = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(compact);
  return match ? `${match[1]} ${match[2]}` : null;
}

/** Keep a postcode that is still being typed out of the mountain/AI search. */
export function looksLikeUkPostcode(input: string): boolean {
  const compact = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d?[A-Z]{0,2}$/.test(compact);
}