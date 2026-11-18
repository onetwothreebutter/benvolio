import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { siteUrl } = await import("./site-url");

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses SITE_URL's origin", () => {
    vi.stubEnv("SITE_URL", "https://benvolio.app/some/path/");
    expect(siteUrl()).toBe("https://benvolio.app");
  });

  it("falls back to Vercel's production domain, never a deployment's own address", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "benvolio-abc123.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "benvolio.app");
    expect(siteUrl()).toBe("https://benvolio.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(() => siteUrl()).toThrow("SITE_URL");
  });

  it("is localhost in development", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
