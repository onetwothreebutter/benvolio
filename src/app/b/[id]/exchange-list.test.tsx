import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { three, validSitting } from "@/test/sittings";
import { ROUNDS } from "@/lib/conversation/rounds";
import { ExchangeList } from "./exchange-list";

/** The paragraphs of each listed item: one of yours, then the partner's response to it. */
function rendered(round: number) {
  const exchange = { items: three("Mine"), response: validSitting(round, "Rhonda").respond! };
  render(
    <ExchangeList
      heading={ROUNDS[round - 1].respond.seen("Rhonda")}
      exchange={exchange}
      author={{ you: true }}
      responder={{ you: false, name: "Rhonda" }}
    />,
  );
  return screen.getAllByRole("listitem").map((item) => within(item).getAllByRole("paragraph").map((p) => p.textContent));
}

describe("ExchangeList: your items, with your partner's responses", () => {
  it("shows the partner's rephrasing under each reason", () => {
    expect(rendered(1)).toEqual([
      ["You wrote: Mine 1", "Rhonda wrote: Rhonda rephrase 1"],
      ["You wrote: Mine 2", "Rhonda wrote: Rhonda rephrase 2"],
      ["You wrote: Mine 3", "Rhonda wrote: Rhonda rephrase 3"],
    ]);
    expect(screen.getByRole("region", { name: "Your reasons, in Rhonda's words" })).toBeVisible();
  });

  it("shows each answer with the feelings tagged, if any", () => {
    expect(rendered(2)).toEqual([
      ["You wrote: Mine 1", "Rhonda wrote: Rhonda answer 1", "It made Rhonda feel hopeful."],
      ["You wrote: Mine 2", "Rhonda wrote: Rhonda answer 2"],
      ["You wrote: Mine 3", "Rhonda wrote: Rhonda answer 3", "It made Rhonda feel sad and relieved."],
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

describe("ExchangeList: your partner's items, with your responses", () => {
  function renderedYours(round: number) {
    const exchange = { items: three("Theirs"), response: validSitting(round, "Me").respond! };
    render(
      <ExchangeList
        heading={ROUNDS[round - 1].respond.given("Rhonda")}
        exchange={exchange}
        author={{ you: false, name: "Rhonda" }}
        responder={{ you: true }}
      />,
    );
    return screen.getAllByRole("listitem").map((item) => within(item).getAllByRole("paragraph").map((p) => p.textContent));
  }

  it("speaks to you about your own responses", () => {
    expect(renderedYours(4)).toEqual([
      ["Rhonda wrote: Theirs 1", "You agree.", "It made you feel hopeful."],
      ["Rhonda wrote: Theirs 2", "You don't agree."],
      ["Rhonda wrote: Theirs 3", "You agree.", "It made you feel sad and relieved."],
    ]);
    expect(screen.getByRole("region", { name: "Whether you agree with Rhonda" })).toBeVisible();
  });

  it("labels your answers as yours", () => {
    expect(renderedYours(2)[0]).toEqual(["Rhonda wrote: Theirs 1", "You wrote: Me answer 1", "It made you feel hopeful."]);
  });

  it("says when you picked no feeling", () => {
    expect(renderedYours(3)[1]).toEqual(["Rhonda wrote: Theirs 2", "You didn't pick a feeling for this."]);
  });
});
