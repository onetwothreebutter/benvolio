import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";

const session = vi.hoisted(() => ({
  getSignedIn: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => session);
const myBenvolios = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/my-benvolios", () => ({ myBenvolios }));

const { default: Home } = await import("./page");

describe("Home", () => {
  beforeEach(() => {
    session.getSignedIn.mockResolvedValue(null);
    session.getProfile.mockResolvedValue(null);
    myBenvolios.mockResolvedValue([]);
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
    expect(screen.getByRole("link", { name: "Start a Benvolio" })).toHaveAttribute("href", "/start");
  });

  it("lists a signed-in person's Benvolios", async () => {
    session.getSignedIn.mockResolvedValue({ userId: "u1", email: "a@example.com" });
    myBenvolios.mockResolvedValue([{ id: "b1", question: "Cats or dogs?" }]);
    render(await Home());
    expect(screen.getByRole("link", { name: "Cats or dogs?" })).toHaveAttribute("href", "/b/b1");
  });
});
