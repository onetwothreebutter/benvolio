import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { join, startConversation, submit, type Conversation, type Role } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";

const loadBenvolioPage = vi.hoisted(() => vi.fn());
vi.mock("../load-page", () => ({ loadBenvolioPage }));

const { default: RoundsPage } = await import("./page");

/** Both people through `last` sittings, then Rhonda (the recipient) through `rhondaAhead` more. */
function conversation(last: number, rhondaAhead = 0): Conversation {
  let c = join(startConversation("Should we get a dog?"));
  const sit = (role: Role, s: number) => (c = submit(c, role, s, validSitting(s, role)));
  for (let s = 0; s <= last; s++) {
    sit("initiator", s);
    sit("recipient", s);
  }
  for (let s = last + 1; s <= last + rhondaAhead; s++) sit("recipient", s);
  return c;
}

async function show(c: Conversation) {
  loadBenvolioPage.mockResolvedValue({ conversation: c, role: "initiator", partnerName: "Rhonda" });
  render(await RoundsPage({ params: Promise.resolve({ id: "b1" }) }));
}

describe("RoundsPage", () => {
  beforeEach(() => loadBenvolioPage.mockReset());

  it("asks for the page's own address when signing in", async () => {
    await show(conversation(0));
    expect(loadBenvolioPage).toHaveBeenCalledWith("b1", "/b/b1/rounds");
    expect(screen.getByRole("link", { name: "Back to your Benvolio" })).toHaveAttribute("href", "/b/b1");
  });

  it("shows nothing but the stances until a round has been responded to by both", async () => {
    await show(conversation(0, 1));
    expect(screen.getByRole("region", { name: "Where you each stand" })).toHaveTextContent(
      "You wrote: initiator stanceRhonda wrote: recipient stance",
    );
    expect(screen.getByText("Each round appears here once you've both responded to it.")).toBeVisible();
    // Rhonda has responded to Jane's reasons, but Jane hasn't written hers yet.
    expect(screen.queryByText("recipient rephrase 1", { exact: false })).toBeNull();
  });

  it("shows every round both have responded to, both ways", async () => {
    await show(conversation(5));
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Where you each stand",
      "Round 1 of 5: Reasons",
      "Round 2 of 5: Questions",
      "Round 3 of 5: Sharing",
      "Round 4 of 5: Accord",
      "Round 5 of 5: Compromise",
    ]);
    expect(screen.getByRole("region", { name: "Your reasons, in Rhonda's words" })).toHaveTextContent(
      "recipient rephrase 1",
    );
    expect(screen.getByRole("region", { name: "Rhonda's reasons, in your words" })).toHaveTextContent(
      "initiator rephrase 1",
    );
    expect(screen.getByRole("region", { name: "How you ranked Rhonda's compromises" })).toHaveTextContent(
      "You ranked this 2nd of 3.",
    );
  });

  it("says so before the openings are revealed", async () => {
    await show(join(startConversation("Should we get a dog?")));
    expect(screen.queryByRole("region", { name: "Where you each stand" })).toBeNull();
    expect(screen.getByText("Each round appears here once you've both responded to it.")).toBeVisible();
  });
});
