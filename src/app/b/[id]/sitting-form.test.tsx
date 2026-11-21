import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { three } from "@/test/sittings";
import { SittingForm } from "./sitting-form";

const submitSitting = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ submitSitting }));

const RANK_SITTING = 5;

describe("SittingForm", () => {
  it("keeps the ranks picked when they come back with an error", async () => {
    submitSitting.mockResolvedValue({
      error: "Please rank them 1 to 3, using each number once.",
      input: { respond: { kind: "rank", ranks: [1, 1, 3] } },
    });
    render(
      <SittingForm
        benvolioId="b"
        sitting={RANK_SITTING}
        partnerName="Rhonda"
        question="Q?"
        revealed={{ items: three("Compromise") }}
      />,
    );
    const ranks = () => screen.getAllByRole<HTMLSelectElement>("combobox");
    [1, 1, 3].forEach((rank, i) => fireEvent.change(ranks()[i], { target: { value: String(rank) } }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("using each number once");
    expect(ranks().map((select) => select.value)).toEqual(["1", "1", "3"]);
  });
});
