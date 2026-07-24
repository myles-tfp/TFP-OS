/** "Jordan · Meridian" — name first, location permanently attached. */
export function memberTitle(
  locationName: string | null | undefined,
  displayName: string | null | undefined,
  email: string
): string {
  const person = displayName?.trim() || email.split("@")[0];
  return locationName ? `${person} · ${locationName}` : person;
}

export function initials(
  displayName: string | null | undefined,
  email: string
): string {
  const source = displayName?.trim() || email;
  const parts = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
