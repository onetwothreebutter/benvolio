// A path segment that looks like a token or id (invite links, record ids).
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;

function redactPath(path: string): string {
  return path
    .split("/")
    .map((segment) => (TOKEN_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

/**
 * Removes query strings, fragments and token-like path segments, so analytics
 * and error reports never record invite tokens or anything typed into a URL.
 * "https://x.app/join/AbC123...?e=a@b.c" becomes "https://x.app/join/:id".
 * Works on absolute URLs and on bare paths ("/join/AbC123...").
 */
export function redactUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://relative.invalid");
  } catch {
    return "";
  }
  const path = redactPath(parsed.pathname);
  return url.startsWith("/") ? path : `${parsed.origin}${path}`;
}

const URL_LIKE = /^(https?:\/\/|\/)/;

/**
 * Redacts every URL-looking string anywhere inside a value, so new properties
 * added by an SDK are covered without listing them by name.
 */
export function redactUrlsDeep<T>(value: T): T {
  if (typeof value === "string") {
    return (URL_LIKE.test(value) ? redactUrl(value) : value) as T;
  }
  if (Array.isArray(value)) return value.map(redactUrlsDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactUrlsDeep(v)]),
    ) as T;
  }
  return value;
}
