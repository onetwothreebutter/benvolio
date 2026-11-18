import { POSTHOG_ASSETS_HOST, POSTHOG_HOST } from "@/lib/analytics/hosts";

/**
 * Forwards PostHog calls made to our own domain (so ad blockers don't drop
 * them). Only the body, query, content type and user agent are passed on:
 * never cookies, the Referer (which can hold an invite link) or the person's
 * IP address.
 */
async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const host = path[0] === "static" ? POSTHOG_ASSETS_HOST : POSTHOG_HOST;
  const incoming = new URL(request.url);
  const trailingSlash = incoming.pathname.endsWith("/") ? "/" : "";
  const target = `${host}/${path.map(encodeURIComponent).join("/")}${trailingSlash}${incoming.search}`;

  const headers = new Headers();
  for (const name of ["content-type", "content-encoding", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const out = new Headers();
  for (const name of ["content-type", "cache-control"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: out });
}

export { forward as GET, forward as POST };
