/** Resource collections — labels for the grouping cards. */
export const COLLECTIONS: [string, string][] = [
  ["playbooks", "Playbooks & Guides"],
  ["content", "Content"],
  ["design", "Design"],
  ["canva", "Canva"],
];

export function collectionLabel(key: string | null): string {
  return COLLECTIONS.find(([k]) => k === key)?.[1] ?? "More";
}
