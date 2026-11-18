import "server-only";

/**
 * This site's address, for links people are sent: SITE_URL, else Vercel's
 * production domain (never a single deployment's address, which is tied to
 * one build and usually behind Vercel's login), else local development.
 */
export function siteUrl(): string {
  const configured =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL) throw new Error("Set SITE_URL (see .env.example)");
  return "http://localhost:3000";
}
