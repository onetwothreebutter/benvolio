/**
 * Where to send someone after signing in. Only a path on this site is allowed,
 * so a crafted link can't bounce a freshly signed-in person to another site.
 */
export function safeNext(value: unknown): string {
  const fallback = "/";
  if (typeof value !== "string" || value.length > 512) return fallback;
  // "//host" and "/\host" are treated by browsers as other sites.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters (including tabs and newlines, which browsers strip) are never needed.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

/** `path`, with `next` as where to go afterwards. */
export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}
