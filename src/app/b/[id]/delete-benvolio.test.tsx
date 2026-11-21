import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteBenvolio } from "./delete-benvolio";

const deleteBenvolio = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ deleteBenvolio }));

describe("DeleteBenvolio", () => {
  it("asks first, saying what goes, and can be backed out of", () => {
    render(<DeleteBenvolio benvolioId="b" partnerName="Rhonda" partnerJoined />);
    expect(screen.queryByRole("button", { name: "Delete it" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete this Benvolio" }));
    expect(screen.getByText(/for you and Rhonda, with everything you both wrote/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete it" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("button", { name: "Delete it" })).not.toBeInTheDocument();
    expect(deleteBenvolio).not.toHaveBeenCalled();
  });

  it("deletes it once confirmed", async () => {
    render(<DeleteBenvolio benvolioId="b1" partnerName="Rhonda" partnerJoined={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete this Benvolio" }));
    expect(screen.getByText(/your invite to Rhonda stops working/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await vi.waitFor(() => expect(deleteBenvolio).toHaveBeenCalled());
    expect((deleteBenvolio.mock.calls[0][0] as FormData).get("benvolio_id")).toBe("b1");
  });
});
