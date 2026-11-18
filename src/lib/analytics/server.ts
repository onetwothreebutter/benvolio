import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";
import { isSendable } from "./guard";
import { POSTHOG_HOST } from "./hosts";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client === undefined) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    client = key ? new PostHog(key, { host: POSTHOG_HOST }) : null;
  }
  return client;
}

/**
 * Records a server-side event for a person (by opaque id). Call it from a server
 * action or route handler: the flush runs after the response is sent, so the
 * person never waits on PostHog, and serverless functions still deliver it.
 */
export function trackServer<E extends AnalyticsEventName>(
  personId: string,
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (!isSendable(event, properties)) return;
  const posthog = getClient();
  if (!posthog) return;
  posthog.capture({ distinctId: personId, event, properties });
  try {
    after(() => posthog.flush());
  } catch {
    // Outside a request (a script or job) there is no after(): flush now.
    void posthog.flush().catch(() => {});
  }
}
