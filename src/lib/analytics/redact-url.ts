// A path segment that looks like a token, id or personal detail: a long run with
// a digit in it (invite tokens, UUIDs), anything percent-encoded, or an email.
const SENSITIVE_SEGMENT = /^(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}$|%|@/;

function redactPath(path: string): string {
  return path
    .split("/")
    .map((segment) => (SENSITIVE_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

/**
 * Removes query strings, fragments and sensitive path segments, so analytics and
 * error reports never record invite tokens or anything typed into a URL.
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

/** Applies `fn` to every string inside a value, skipping the keys in `skip`. */
export function mapStringsDeep<T>(
  value: T,
  fn: (s: string) => string,
  skip: ReadonlySet<string> = new Set(),
): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStringsDeep(v, fn, skip)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, skip.has(k) ? v : mapStringsDeep(v, fn, skip)]),
    ) as T;
  }
  return value;
}

/**
 * Redacts every value that is a URL or path, anywhere inside a value, so new
 * properties added by an SDK are covered without listing them by name.
 */
export function redactUrlsDeep<T>(value: T): T {
  return mapStringsDeep(value, (s) => (URL_LIKE.test(s) ? redactUrl(s) : s));
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>`]+/g;
const PATH_IN_TEXT = /(?<![\w.])\/[A-Za-z0-9_\-./%@]+\?[^\s"'<>`]*/g;
const EMAIL_IN_TEXT = /[^\s"'<>@]+@[^\s"'<>@]+\.[A-Za-z]{2,}/g;
const TOKEN_IN_TEXT = /(?<![A-Za-z0-9_-])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g;

/**
 * Scrubs free text such as error messages and log lines: URLs anywhere in the
 * text, emails and token-like runs are replaced.
 */
export function scrubText(text: string): string {
  return text
    .replace(URL_IN_TEXT, (url) => redactUrl(url))
    .replace(PATH_IN_TEXT, (path) => redactUrl(path))
    .replace(EMAIL_IN_TEXT, "[email]")
    .replace(TOKEN_IN_TEXT, ":id");
}
