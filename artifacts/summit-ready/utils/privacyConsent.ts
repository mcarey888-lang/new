export type PrivacyChoice = { version: 1; analytics: boolean; advertising: boolean };
export const PRIVACY_KEY = "summitready_privacy_choice_v1";
export function parsePrivacyChoice(raw: string | null): PrivacyChoice | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return value?.version === 1 && typeof value.analytics === "boolean" &&
      typeof value.advertising === "boolean" ? value : null;
  } catch { return null; }
}
/** Unknown and corrupt preferences never authorise optional measurement. */
export function permits(choice: PrivacyChoice | null, purpose: "analytics" | "advertising"): boolean {
  return choice?.[purpose] === true;
}
