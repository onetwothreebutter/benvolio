import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";

const session = vi.hoisted(() => ({
  getSignedIn: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => session);

const { default: Home } = await import("./page");

describe("Home", () => {
  beforeEach(() => {
    session.getSignedIn.mockResolvedValue(null);
    session.getProfile.mockResolvedValue(null);
  });

  it("shows the product name and tagline, and a way to sign in", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { name: PRODUCT_NAME })).toBeInTheDocument();
    expect(screen.getByText(TAGLINE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("greets a signed-in person and lets them sign out", async () => {
    session.getSignedIn.mockResolvedValue({ userId: "u1", email: "a@example.com" });
    session.getProfile.mockResolvedValue({ firstName: "Jane" });
    render(await Home());
    expect(screen.getByText("Signed in as Jane.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
