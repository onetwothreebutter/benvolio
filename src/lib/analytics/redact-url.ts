// Route segments whose next segment is always a token or id.
const ID_ROUTES = new Set(["join", "b"]);

// A path segment that looks like a token, id or personal detail: a long run with
// a digit in it, anything percent-encoded, an email, or path parameters (";").
const SENSITIVE_SEGMENT = /^(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}$|[%@;]/;

function redactPath(path: string): string {
  const segments = path.split("/");
  return segments
    .map((segment, i) =>
      segment && (SENSITIVE_SEGMENT.test(segment) || ID_ROUTES.has(segments[i - 1]))
        ? ":id"
        : segment,
    )
    .join("/");
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Removes query strings, fragments and sensitive path segments, so analytics and
 * error reports never record invite tokens or anything typed into a URL.
 * "https://x.app/join/AbC123...?e=a@b.c" becomes "https://x.app/join/:id".
 * Works on absolute URLs and on bare paths ("/join/AbC123...").
 */
export function redactUrl(url: string): string {
  const [beforeQuery] = url.split(/[?#]/, 1);
  const match = ABSOLUTE.exec(beforeQuery);
  if (!match) return redactPath(beforeQuery);
  const afterScheme = beforeQuery.slice(match[0].length);
  const slash = afterScheme.indexOf("/");
  if (slash === -1) return beforeQuery;
  return match[0] + afterScheme.slice(0, slash) + redactPath(afterScheme.slice(slash));
}

const URL_LIKE = /^([a-z][a-z0-9+.-]*:\/\/|\/)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Applies `fn` to every string inside plain objects and arrays, using `special`
 * instead for the keys it names. Other values (dates, class instances) and
 * repeated references are left as they are.
 */
export function mapStringsDeep<T>(
  value: T,
  fn: (s: string) => string,
  special: Record<string, (v: unknown) => unknown> = {},
  seen = new WeakSet<object>(),
): T {
  if (typeof value === "string") return fn(value) as T;
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => mapStringsDeep(v, fn, special, seen)) as T;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      special[k] ? special[k](v) : mapStringsDeep(v, fn, special, seen),
    ]),
  ) as T;
}

/**
 * Redacts every value that is a URL or path, anywhere inside a value, so new
 * properties added by an SDK are covered without listing them by name.
 */
export function redactUrlsDeep<T>(value: T): T {
  return mapStringsDeep(value, (s) => (URL_LIKE.test(s) ? redactUrl(s) : s));
}

// Longer text is cut before scrubbing, which keeps every pattern below cheap.
export const MAX_SCRUBBED_LENGTH = 2000;

const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`]+/gi;
const PATH_IN_TEXT = /(?<![\w.:/])\/[^\s"'<>`]+/g;
const EMAIL_IN_TEXT = /[^\s"'<>@]+@[^\s"'<>@]+\.[A-Za-z]{2,}/g;
const TOKEN_IN_TEXT = /[A-Za-z0-9_-]{16,}/g;
// Engines quote the input in some messages, e.g. JSON.parse: "We should "... is not valid JSON.
const QUOTED_IN_TEXT = /"[^"]{4,}"|`[^`]{4,}`/g;

/**
 * Scrubs free text such as error messages: URLs and paths anywhere in the text,
 * emails, token-like runs and quoted input are replaced.
 */
export function scrubText(text: string): string {
  const cut = text.length > MAX_SCRUBBED_LENGTH ? `${text.slice(0, MAX_SCRUBBED_LENGTH)}…` : text;
  return cut
    .replace(URL_IN_TEXT, (url) => redactUrl(url))
    .replace(PATH_IN_TEXT, (path) => redactUrl(path))
    .replace(EMAIL_IN_TEXT, "[email]")
    .replace(TOKEN_IN_TEXT, (run) => (/\d/.test(run) ? ":id" : run))
    .replace(QUOTED_IN_TEXT, '"[text]"');
}
