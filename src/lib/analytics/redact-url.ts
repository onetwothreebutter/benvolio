// A path segment that looks like a token or id (invite links, record ids).
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;

/**
 * Removes query strings, fragments and token-like path segments, so analytics
 * never record invite tokens or anything typed into a URL.
 * "https://x.app/join/AbC123...?e=a@b.c" becomes "https://x.app/join/:id".
 */
export function redactUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const path = parsed.pathname
    .split("/")
    .map((segment) => (TOKEN_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
  return `${parsed.origin}${path}`;
}
