import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

// Next builds this file once per runtime (Node and edge), so one init covers both.
export function register() {
  Sentry.init({
    ...sentryOptions,
    // Answers the browser's reports on our own domain, so ad blockers don't drop them.
    integrations: [Sentry.serveTunnelIntegration()],
  });
}

export const onRequestError = Sentry.captureRequestError;
