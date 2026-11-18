import posthog, { type CaptureResult } from "posthog-js";
import {
  assertSafeProperties,
  type AnalyticsEventName,
  type AnalyticsEvents,
} from "./events";
import { redactUrl } from "./redact-url";

const URL_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$prev_pageview_url",
] as const;

export function redactCapture(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  for (const key of URL_PROPERTIES) {
    const value = event.properties[key];
    if (typeof value === "string") event.properties[key] = redactUrl(value);
  }
  return event;
}

let started = false;

/** Starts PostHog in the browser. Does nothing without a project key. */
export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (started || !key) return;
  posthog.init(key, {
    // Proxied through next.config.ts so ad blockers don't drop events.
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://us.posthog.com",
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    // Only explicit, typed events: autocapture could pick up text on screen.
    autocapture: false,
    capture_pageview: "history_change",
    capture_performance: { web_vitals: true, network_timing: false },
    disable_session_recording: true,
    mask_all_text: true,
    before_send: redactCapture,
  });
  started = true;
}

export function track<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  assertSafeProperties(properties);
  if (started) posthog.capture(event, properties);
}

/** Links events to a signed-in person by their opaque id, never their email. */
export function identify(personId: string): void {
  if (started) posthog.identify(personId);
}

export function resetIdentity(): void {
  if (started) posthog.reset();
}
