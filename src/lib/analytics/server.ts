import "server-only";
import { PostHog } from "posthog-node";
import {
  assertSafeProperties,
  type AnalyticsEventName,
  type AnalyticsEvents,
} from "./events";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client === undefined) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    client = key
      ? new PostHog(key, {
          host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
        })
      : null;
  }
  return client;
}

/**
 * Records a server-side event for a person (by opaque id). Sent immediately,
 * since serverless functions may stop before a batch would flush.
 */
export async function trackServer<E extends AnalyticsEventName>(
  personId: string,
  event: E,
  properties: AnalyticsEvents[E],
): Promise<void> {
  assertSafeProperties(properties);
  await getClient()?.captureImmediate({ distinctId: personId, event, properties });
}
