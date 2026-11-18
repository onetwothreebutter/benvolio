import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import Home from "./page";

describe("Home", () => {
  it("shows the product name and tagline", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: PRODUCT_NAME })).toBeTruthy();
    expect(screen.getByText(TAGLINE)).toBeTruthy();
  });
});
