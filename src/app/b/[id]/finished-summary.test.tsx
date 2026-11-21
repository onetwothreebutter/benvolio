import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Summary } from "@/lib/conversation/model";
import { three } from "@/test/sittings";
import { FinishedSummary } from "./finished-summary";

const base: Summary = {
  stances: [
    { text: "We should get a dog", mine: true },
    { text: "Not yet", mine: false },
  ],
  agreed: [
    { text: "We both love walks", mine: true },
    { text: "The flat is small", mine: false },
  ],
  differ: [{ text: "A dog is a lot of work", mine: false }],
  compromises: { mine: three("Mine"), partner: three("Hers") },
};

/** The paragraphs of each listed item in a section. */
function section(name: string) {
  const region = screen.getByRole("region", { name });
  return within(region)
    .getAllByRole("listitem")
    .map((item) => within(item).queryAllByRole("paragraph").map((p) => p.textContent));
}

describe("FinishedSummary", () => {
  it("leads with what both people agree on, saying who wrote each point", () => {
    render(<FinishedSummary summary={base} partnerName="Rhonda" />);
    expect(section("What you agree on")).toEqual([
      ["We both love walks", "You wrote this"],
      ["The flat is small", "Rhonda wrote this"],
    ]);
    expect(section("Still to talk about")).toEqual([["A dog is a lot of work", "Rhonda wrote this"]]);
    expect(section("Where you each started")).toEqual([
      ["We should get a dog", "Your view"],
      ["Not yet", "Rhonda's view"],
    ]);
  });

  it("puts each person's first-choice compromise first, then every compromise in ranked order", () => {
    render(<FinishedSummary summary={base} partnerName="Rhonda" />);
    const lists = within(screen.getByRole("region", { name: "The compromises you each liked most" })).getAllByRole(
      "list",
    );
    expect(lists.map((list) => within(list).getAllByRole("listitem").map((li) => li.textContent))).toEqual([
      ["Hers 1Your first choice of Rhonda's", "Mine 1Rhonda's first choice of yours"],
      ["Hers 1", "Hers 2", "Hers 3"],
      ["Mine 1", "Mine 2", "Mine 3"],
    ]);
    expect(screen.getByRole("heading", { name: "All of Rhonda's, as you ranked them" })).toBeVisible();
  });

  it("leaves out compromises when no round ranked them", () => {
    render(<FinishedSummary summary={{ ...base, compromises: undefined }} partnerName="Rhonda" />);
    expect(screen.queryByRole("region", { name: "The compromises you each liked most" })).toBeNull();
  });

  it("says so when there was no agreement, and leaves out an empty list of differences", () => {
    render(<FinishedSummary summary={{ ...base, agreed: [], differ: [] }} partnerName="Rhonda" />);
    expect(screen.getByText("Neither of you agreed with the other's points this time.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Still to talk about" })).toBeNull();
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  });
});
