import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { three, validSitting } from "@/test/sittings";
import { PartnerResponses } from "./partner-responses";

/** The paragraphs of each listed item: one of yours, then the partner's response to it. */
function rendered(round: number) {
  const exchange = { round, items: three("Mine"), response: validSitting(round, "Rhonda").respond! };
  render(<PartnerResponses exchange={exchange} partnerName="Rhonda" />);
  return screen.getAllByRole("listitem").map((item) => within(item).getAllByRole("paragraph").map((p) => p.textContent));
}

describe("PartnerResponses", () => {
  it("shows the partner's rephrasing under each reason", () => {
    expect(rendered(1)).toEqual([
      ["Mine 1", "Rhonda rephrase 1"],
      ["Mine 2", "Rhonda rephrase 2"],
      ["Mine 3", "Rhonda rephrase 3"],
    ]);
    expect(screen.getByRole("heading", { name: "Your reasons, in Rhonda's words" })).toBeVisible();
  });

  it("shows each answer with the feelings tagged, if any", () => {
    expect(rendered(2)).toEqual([
      ["Mine 1", "Rhonda answer 1", "It made Rhonda feel hopeful."],
      ["Mine 2", "Rhonda answer 2"],
      ["Mine 3", "Rhonda answer 3", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("says the partner read what was shared when they tagged no feeling", () => {
    expect(rendered(3)).toEqual([
      ["Mine 1", "It made Rhonda feel hopeful."],
      ["Mine 2", "Rhonda read this."],
      ["Mine 3", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("says whether the partner agrees", () => {
    expect(rendered(4)).toEqual([
      ["Mine 1", "Rhonda agrees.", "It made Rhonda feel hopeful."],
      ["Mine 2", "Rhonda doesn't agree."],
      ["Mine 3", "Rhonda agrees.", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("shows where the partner ranked each compromise", () => {
    expect(rendered(5)).toEqual([
      ["Mine 1", "Rhonda's second choice."],
      ["Mine 2", "Rhonda's first choice."],
      ["Mine 3", "Rhonda's third choice."],
    ]);
  });
});
