import * as Sentry from "@sentry/nextjs";
import { findUnsafeProperty } from "./events";

/**
 * True if the event may be sent. An unsafe property is a bug, so it is reported
 * to Sentry (by property name only) and the event is dropped rather than thrown,
 * which would break whatever the person was doing.
 */
export function isSendable(event: string, properties: Record<string, unknown>): boolean {
  const key = findUnsafeProperty(properties);
  if (key === null) return true;
  Sentry.captureMessage(`Dropped analytics event "${event}": unsafe property "${key}"`, "error");
  return false;
}
