import type { CaptureResult, PostHog } from "posthog-js";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";
import { isSendable } from "./guard";
import { redactUrlsDeep } from "./redact-url";

export function redactCapture(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  return {
    ...event,
    properties: redactUrlsDeep(event.properties),
    $set: redactUrlsDeep(event.$set),
    $set_once: redactUrlsDeep(event.$set_once),
  };
}

let loading: Promise<PostHog | null> | undefined;

/**
 * Loads PostHog on first use, off the critical path, and only when a project
 * key is set. Calls made before it loads wait for it.
 */
function posthog(): Promise<PostHog | null> {
  loading ??= (async () => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return null;
    const { default: client } = await import("posthog-js");
    client.init(key, {
      // Proxied through next.config.ts so ad blockers don't drop events.
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://us.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only",
      // Only explicit, typed events: autocapture could pick up text on screen.
      autocapture: false,
      // Everything below is set here so a toggle in the PostHog project settings
      // can never switch on something that could record what people wrote.
      disable_session_recording: true,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_exceptions: false,
      logs: { captureConsoleLogs: false },
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      // Feature-flag requests send the first URL a person visited, which can be
      // an invite link, and they bypass before_send. Off until flags are needed.
      advanced_disable_flags: true,
      capture_performance: { web_vitals: true, network_timing: false },
      before_send: redactCapture,
    });
    return client;
  })().catch(() => null);
  return loading;
}

/** Starts PostHog once the page is idle. Does nothing without a project key. */
export function initAnalytics(): void {
  const start = () => void posthog();
  if (typeof requestIdleCallback === "function") requestIdleCallback(start);
  else setTimeout(start, 1);
}

export function track<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (!isSendable(event, properties)) return;
  void posthog().then((client) => client?.capture(event, properties));
}

/** Links events to a signed-in person by their opaque id, never their email. */
export function identify(personId: string): void {
  void posthog().then((client) => client?.identify(personId));
}

export function resetIdentity(): void {
  void posthog().then((client) => client?.reset());
}
