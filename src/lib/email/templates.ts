/**
 * The emails Benvolio sends, as plain functions of their facts. They name the
 * partner and link to the Benvolio, but never quote the question or anything
 * anyone wrote: an inbox is less private than the app.
 */

import { sittingName } from "@/lib/conversation/status";
import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import type { TurnReason } from "./turn-notice";

export type Message = { subject: string; html: string; text: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The app's light palette (globals.css), inlined: many mail apps drop <style>.
const BG = "#f7f1e8";
const TEXT = "#2b2420";
const MUTED = "#6b5f57";
const ACCENT = "#a84b29";
// Single quotes inside: it goes in a double-quoted style attribute.
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

type Layout = {
  subject: string;
  paragraphs: string[];
  /** The button's label: it opens `link`. */
  action: string;
  link: string;
  partner: string;
};

/** One short note with a button, as HTML and as plain text. */
function layout({ subject, paragraphs, action, link, partner }: Layout): Message {
  const footer = `You're getting this because you're in a ${PRODUCT_NAME} with ${partner}.`;
  const p = (s: string) => `<p style="margin:0 0 16px">${escapeHtml(s)}</p>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BG}">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:${FONT};font-size:16px;line-height:1.5;color:${TEXT}">
<p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:${ACCENT}">${PRODUCT_NAME}</p>
${paragraphs.map(p).join("\n")}
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${ACCENT};color:#ffffff;font-weight:bold;text-decoration:none">${escapeHtml(action)}</a></p>
<p style="margin:32px 0 0;font-size:13px;color:${MUTED}">${escapeHtml(footer)}<br>${PRODUCT_NAME} · ${TAGLINE}</p>
</div>
</body></html>`;
  const text = [...paragraphs, `${action}: ${link}`, footer].join("\n\n");
  return { subject, html, text };
}

type Turn = {
  /** The partner's first name in this Benvolio. */
  partner: string;
  /** The sitting it's now this person's turn for. */
  sitting: number;
  /** The Benvolio's page. */
  link: string;
};

const YOUR_TURN: Record<TurnReason, (partner: string, sitting: number) => Pick<Layout, "subject" | "paragraphs" | "action">> = {
  waiting: (partner, sitting) => ({
    subject: `Your turn with ${partner}`,
    paragraphs: [
      `${partner} has written ${sitting === 0 ? "their opening" : `their part of ${sittingName(sitting)}`}.`,
      "Once you send yours, you'll each see what the other wrote.",
    ],
    action: "Write yours",
  }),
  readable: (partner, sitting) => ({
    subject: `Your turn with ${partner}`,
    paragraphs: [
      `${partner} has sent their part, so you can now read what you each wrote.`,
      `It's your turn: ${sittingName(sitting)}.`,
    ],
    action: "Read and reply",
  }),
  start: (partner) => ({
    subject: `Your turn with ${partner}`,
    paragraphs: [`You and ${partner} are ready to begin. It's your turn to write ${sittingName(0)}.`],
    action: "Write it",
  }),
};

/** It's this person's turn, for the reason given (see TurnReason). */
export function yourTurnEmail({ partner, sitting, link, why }: Turn & { why: TurnReason }): Message {
  return layout({ ...YOUR_TURN[why](partner, sitting), link, partner });
}

const CHOOSE_WORDING = "Choose which wording to use, and you can both begin.";

/** The recipient joined and suggested new wording, which the initiator decides on. */
export function questionProposedEmail({ partner, link }: Omit<Turn, "sitting">): Message {
  return layout({
    subject: `${partner} suggested new wording`,
    paragraphs: [
      `${partner} has joined your ${PRODUCT_NAME} and suggested new wording for the question.`,
      `${CHOOSE_WORDING} If you've written your opening, using the new wording means writing it again.`,
    ],
    action: "Choose",
    link,
    partner,
  });
}

/** A gentle nudge after quiet days: it's still their turn, or the wording still waits on them. */
export function reminderEmail({
  partner,
  link,
  sitting,
  last,
}: Omit<Turn, "sitting"> & {
  /** The sitting it's their turn for, or null when new wording waits on them. */
  sitting: number | null;
  /** The last reminder about this: say so. */
  last: boolean;
}): Message {
  const ending = last ? ["This is the last reminder we'll send about it."] : [];
  if (sitting === null) {
    return layout({
      subject: `${partner} is waiting on the question's wording`,
      paragraphs: [
        `${partner} suggested new wording for your ${PRODUCT_NAME}'s question.`,
        CHOOSE_WORDING,
        ...ending,
      ],
      action: "Choose",
      link,
      partner,
    });
  }
  return layout({
    subject: `It's still your turn with ${partner}`,
    paragraphs: [
      `A gentle reminder: it's your turn to write ${sittingName(sitting)} in your ${PRODUCT_NAME} with ${partner}.`,
      "There's no rush. It's waiting for you whenever you have a quiet moment.",
      ...ending,
    ],
    action: "Continue",
    link,
    partner,
  });
}

/** The partner sent the last sitting, so the whole conversation is revealed. */
export function finishedEmail({ partner, link }: Omit<Turn, "sitting">): Message {
  return layout({
    subject: `Your ${PRODUCT_NAME} with ${partner} is finished`,
    paragraphs: [
      `${partner} has sent their last part, so you can now read everything you each wrote.`,
      "Thank you both for taking the time to listen.",
    ],
    action: "Read it",
    link,
    partner,
  });
}
