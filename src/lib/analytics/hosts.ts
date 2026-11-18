// The PostHog region. Set POSTHOG_HOST (and NEXT_PUBLIC_POSTHOG_UI_HOST) for EU projects.
export const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
export const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace(/:\/\/(\w+)\.i\./, "://$1-assets.i.");
