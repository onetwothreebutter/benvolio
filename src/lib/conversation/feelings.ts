/**
 * The feelings someone can tag a partner's item with, in the order offered.
 * Slugs are stored; labels are shown. Like anything written, they are never
 * sent to analytics.
 */
export const FEELINGS = [
  { slug: "hopeful", label: "Hopeful" },
  { slug: "understood", label: "Understood" },
  { slug: "grateful", label: "Grateful" },
  { slug: "relieved", label: "Relieved" },
  { slug: "surprised", label: "Surprised" },
  { slug: "curious", label: "Curious" },
  { slug: "confused", label: "Confused" },
  { slug: "worried", label: "Worried" },
  { slug: "sad", label: "Sad" },
  { slug: "hurt", label: "Hurt" },
  { slug: "frustrated", label: "Frustrated" },
  { slug: "defensive", label: "Defensive" },
] as const;

export const MAX_FEELINGS_PER_ITEM = 3;

const SLUGS: ReadonlySet<string> = new Set(FEELINGS.map((f) => f.slug));

export function isFeeling(value: unknown): boolean {
  return typeof value === "string" && SLUGS.has(value);
}

const LABELS: ReadonlyMap<string, string> = new Map(FEELINGS.map((f) => [f.slug, f.label]));

/** The label shown for a stored feeling. */
export function feelingLabel(slug: string): string {
  const label = LABELS.get(slug);
  if (label === undefined) throw new Error(`Unknown feeling: ${slug}`);
  return label;
}
