/**
 * The five rounds of a Benvolio, as data. Each round has a write part (three
 * items each person writes) and a respond part (what each person does with the
 * partner's three items once they are revealed). Changing the wording or trying
 * a different round means editing this file, not the screens.
 */

import type { Response } from "./model";

export const ITEMS_PER_ROUND = 3;

export type ResponseKind = Response["kind"];

/** A round's number is its position in ROUNDS plus one. */
export type Round = {
  title: string;
  write: {
    prompt: string;
    help: string;
    itemLabel: string;
  };
  respond: {
    kind: ResponseKind;
    /** What one of the partner's items is called, in "Rhonda's reason 1". */
    itemName: string;
    prompt: string;
    help?: string;
    /** Heads the partner's responses to your items, once they're revealed. */
    seen: (partner: string) => string;
    /** Heads your responses to the partner's items. */
    given: (partner: string) => string;
  };
};

export const ROUNDS: readonly Round[] = [
  {
    title: "Reasons",
    write: {
      prompt: "What are three reasons you hold your view?",
      help: "Give the reasons that matter most to you.",
      itemLabel: "Reason",
    },
    respond: {
      kind: "rephrase",
      itemName: "reason",
      prompt: "Rephrase each of your partner's reasons in your own words.",
      help: "To show that you're listening to each other, you'll each rephrase the other's reasons.",
      seen: (partner) => `Your reasons, in ${partner}'s words`,
      given: (partner) => `${partner}'s reasons, in your words`,
    },
  },
  {
    title: "Questions",
    write: {
      prompt: "What are three questions you have for your partner?",
      help: "Ask what would help them understand your point of view. Sincere questions, free of provocation, are best.",
      itemLabel: "Question",
    },
    respond: {
      kind: "answer",
      itemName: "question",
      prompt: "Answer your partner's questions honestly.",
      help: "How can you answer in a way that helps them understand your point of view? You can tag each question with how it made you feel.",
      seen: (partner) => `${partner}'s answers to your questions`,
      given: (partner) => `Your answers to ${partner}'s questions`,
    },
  },
  {
    title: "Sharing",
    write: {
      prompt: "What are three things you'd like your partner to know?",
      help: "These can be feelings, facts, or things you've realised but haven't been able to say.",
      itemLabel: "Something to share",
    },
    respond: {
      kind: "react",
      itemName: "thing to know",
      prompt: "Read what your partner wanted you to know.",
      help: "Take your time. You can tag each one with how it made you feel.",
      seen: (partner) => `How ${partner} felt about what you shared`,
      given: (partner) => `How you felt about what ${partner} shared`,
    },
  },
  {
    title: "Accord",
    write: {
      prompt: "What are three things you think you both agree on?",
      help: "Look for common ground that could move the conversation forward.",
      itemLabel: "We both agree",
    },
    respond: {
      kind: "agree",
      itemName: "point of agreement",
      prompt: "Do you agree with each of these?",
      seen: (partner) => `Whether ${partner} agrees with you`,
      given: (partner) => `Whether you agree with ${partner}`,
    },
  },
  {
    title: "Compromise",
    write: {
      prompt: "What are three compromises you could live with?",
      help: "Good compromises ask roughly equal concessions of each of you.",
      itemLabel: "Possible compromise",
    },
    respond: {
      kind: "rank",
      itemName: "compromise",
      prompt: "Rank your partner's compromises, 1 being the one you like most.",
      seen: (partner) => `How ${partner} ranked your compromises`,
      given: (partner) => `How you ranked ${partner}'s compromises`,
    },
  },
];
