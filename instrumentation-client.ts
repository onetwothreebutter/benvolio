import * as Sentry from "@sentry/nextjs";
import { initAnalytics } from "@/lib/analytics/client";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

// Session replay is deliberately not enabled: screens show what people wrote.
Sentry.init(sentryOptions);
initAnalytics();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
