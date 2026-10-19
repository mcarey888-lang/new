/** Public identity must never fall back to login/email fields. */
export type PublicIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  unsafeMetadata?: Record<string, unknown>;
};

export const MEMBER_NAME = "SummitReady member";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function explicitDisplayName(user?: PublicIdentity | null): string {
  return text(user?.unsafeMetadata?.summitReadyDisplayName);
}

export function publicDisplayName(user?: PublicIdentity | null): string {
  // This field is written only when the user changes their public name in Edit profile.
  const explicit = explicitDisplayName(user);
  if (explicit) return explicit;
  const name = [text(user?.firstName), text(user?.lastName)].filter(Boolean).join(" ");
  const username = text(user?.username);
  // Old records have no reliable provenance: suppress email-like values, not accounts.
  return [name, username].find(value => value && !value.includes("@")) || MEMBER_NAME;
}

export function editableDisplayName(user?: PublicIdentity | null): string {
  const explicit = explicitDisplayName(user);
  if (explicit) return explicit;
  const firstName = text(user?.firstName);
  return firstName.includes("@") ? "" : firstName;
}
