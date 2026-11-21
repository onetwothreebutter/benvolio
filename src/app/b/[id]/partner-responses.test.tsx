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
      ["You wrote: Mine 1", "Rhonda: Rhonda rephrase 1"],
      ["You wrote: Mine 2", "Rhonda: Rhonda rephrase 2"],
      ["You wrote: Mine 3", "Rhonda: Rhonda rephrase 3"],
    ]);
    expect(screen.getByRole("region", { name: "Your reasons, in Rhonda's words" })).toBeVisible();
  });

  it("shows each answer with the feelings tagged, if any", () => {
    expect(rendered(2)).toEqual([
      ["You wrote: Mine 1", "Rhonda: Rhonda answer 1", "It made Rhonda feel hopeful."],
      ["You wrote: Mine 2", "Rhonda: Rhonda answer 2"],
      ["You wrote: Mine 3", "Rhonda: Rhonda answer 3", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("says the partner read what was shared when they tagged no feeling", () => {
    expect(rendered(3)).toEqual([
      ["You wrote: Mine 1", "It made Rhonda feel hopeful."],
      ["You wrote: Mine 2", "Rhonda didn't pick a feeling for this."],
      ["You wrote: Mine 3", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("says whether the partner agrees", () => {
    expect(rendered(4)).toEqual([
      ["You wrote: Mine 1", "Rhonda agrees.", "It made Rhonda feel hopeful."],
      ["You wrote: Mine 2", "Rhonda doesn't agree."],
      ["You wrote: Mine 3", "Rhonda agrees.", "It made Rhonda feel sad and relieved."],
    ]);
  });

  it("shows where the partner ranked each compromise", () => {
    expect(rendered(5)).toEqual([
      ["You wrote: Mine 1", "Rhonda ranked this 2nd of 3."],
      ["You wrote: Mine 2", "Rhonda ranked this 1st of 3."],
      ["You wrote: Mine 3", "Rhonda ranked this 3rd of 3."],
    ]);
  });
});
