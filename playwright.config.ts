import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/support/local-supabase";

/**
 * End-to-end tests: the real app against a local Supabase (`npx supabase
 * start`), reading sign-in emails from its Mailpit inbox. See e2e/README.md.
 */
const supabase = localSupabase();
const PORT = 3000; // Supabase's site_url, which the emailed sign-in link is built from.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // `next dev` compiles each page on first visit, which can take a while.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    // For machines with a Chromium already installed instead of `npx playwright install`.
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "mobile-chromium" }],
  webServer: {
    // CI tests the production build; locally, dev mode starts faster.
    command: process.env.CI ? "npx next build --no-lint && npx next start" : "npx next dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // These win over .env.local, so the app never talks to production Supabase,
    // PostHog or Sentry while under test.
    env: {
      PORT: String(PORT),
      SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      SUPABASE_SECRET_KEY: supabase.secretKey,
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
