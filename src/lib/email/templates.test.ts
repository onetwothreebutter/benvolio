import { describe, expect, it } from "vitest";
import { finishedEmail, questionProposedEmail, reminderEmail, yourTurnEmail } from "./templates";

const link = "https://benvolio.test/b/00000000-0000-4000-8000-0000000000b1";

describe("email templates", () => {
  it("says why it's their turn, and links to the Benvolio", () => {
    const revealed = yourTurnEmail({ partner: "Jane", sitting: 2, link, why: "readable" });
    expect(revealed.subject).toBe("Your turn with Jane");
    expect(revealed.text).toContain("you can now read what you each wrote");
    expect(revealed.text).toContain("It's your turn: sitting 3 of 6.");
    const waiting = yourTurnEmail({ partner: "Jane", sitting: 0, link, why: "waiting" });
    expect(waiting.subject).toBe("Your turn with Jane");
    expect(waiting.text).toContain("Jane has written their opening.");
    expect(yourTurnEmail({ partner: "Jane", sitting: 2, link, why: "waiting" }).text).toContain(
      "Jane has written their part of sitting 3 of 6.",
    );
    const start = yourTurnEmail({ partner: "Jane", sitting: 0, link, why: "start" });
    expect(start.text).toContain("It's your turn to write your opening.");
    const proposed = questionProposedEmail({ partner: "Rhonda", link });
    expect(proposed.subject).toBe("Rhonda suggested new wording");
    for (const email of [revealed, waiting, start, proposed, finishedEmail({ partner: "Jane", link })]) {
      expect(email.html).toContain(`href="${link}"`);
      expect(email.text).toContain(link);
    }
  });

  it("keeps the whole font list inside its style attribute", () => {
    const { html } = finishedEmail({ partner: "Jane", link });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("body > div")?.getAttribute("style")).toContain("'Segoe UI', Roboto, sans-serif;");
  });

  it("escapes names in the HTML", () => {
    const email = finishedEmail({ partner: `<b>"Jo" & co</b>`, link });
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&#60;b&#62;&#34;Jo&#34; &#38; co&#60;/b&#62;");
    expect(email.text).toContain(`<b>"Jo" & co</b> has sent their last part`);
  });
});

describe("reminders", () => {
  it("nudge gently about a sitting or the wording, and say when it's the last", () => {
    const turn = reminderEmail({ partner: "Jane", link, sitting: 3, last: false });
    expect(turn.subject).toBe("It's still your turn with Jane");
    expect(turn.text).toContain("it's your turn to write sitting 4 of 6 in your Benvolio with Jane.");
    expect(turn.text).not.toContain("last reminder");
    const wording = reminderEmail({ partner: "Rhonda", link, sitting: null, last: true });
    expect(wording.subject).toBe("Rhonda is waiting on the question's wording");
    expect(wording.text).toContain("This is the last reminder we'll send about it.");
  });
});
