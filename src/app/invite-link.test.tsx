import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteLink } from "./invite-link";

const URL = "https://benvolio.app/join/abc";

function setNavigator(props: { share?: unknown; clipboard?: unknown }) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

afterEach(() => {
  for (const key of ["share", "clipboard"]) delete (navigator as unknown as Record<string, unknown>)[key];
  vi.restoreAllMocks();
});

describe("InviteLink", () => {
  it("renders Copy on the server, whatever the browser can do", () => {
    setNavigator({ share: vi.fn() });
    expect(renderToString(<InviteLink url={URL} partnerName="Rhonda" />)).toContain("Copy the link");
  });

  it("offers the share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    render(<InviteLink url={URL} partnerName="Rhonda" />);
    fireEvent.click(screen.getByRole("button", { name: "Share the link" }));
    expect(share).toHaveBeenCalledWith({ title: "Benvolio", url: URL });
  });

  it("copies the link without a share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });
    render(<InviteLink url={URL} partnerName="Rhonda" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy the link" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(URL);
  });

  it("says so and selects the link when copying fails", async () => {
    setNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<InviteLink url={URL} partnerName="Rhonda" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy the link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't copy it.");
    const input = screen.getByLabelText<HTMLInputElement>("Invite link");
    expect(document.activeElement).toBe(input);
    expect(input.selectionEnd! - input.selectionStart!).toBe(URL.length);
    expect(screen.getByRole("button", { name: "Copy the link" })).toBeInTheDocument();
  });
});
