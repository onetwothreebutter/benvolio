import { ITEMS_PER_ROUND, ROUNDS, type ResponseKind } from "./rounds";

/**
 * The turn-taking rules of a Benvolio, as pure functions over plain data.
 *
 * Each person sits down six times. Sitting 0 is the opening: your stance and
 * three reasons. In sittings 1 to 4 you respond to the round your partner just
 * revealed and write your part of the next round. Sitting 5 is the last
 * response. A sitting is revealed to both people only once both have submitted
 * it, so neither ever sees the other's writing for a sitting before writing
 * their own.
 *
 * The question is settled before anyone's stance is revealed. If the recipient
 * suggests new wording, they wait until the initiator decides; if the initiator
 * accepts it, their own opening reopens so their stance answers the question
 * as it now stands.
 */

const ROLES = ["initiator", "recipient"] as const;
export type Role = (typeof ROLES)[number];

const LAST_SITTING = ROUNDS.length;
const SITTINGS = LAST_SITTING + 1;

export type Items = [string, string, string];
export type Tags = [string[], string[], string[]];

export type Response =
  /** Rewrite each item in your own words. */
  | { kind: "rephrase"; texts: Items }
  /** Answer each item, optionally tagging how it made you feel. */
  | { kind: "answer"; texts: Items; tags: Tags }
  /** Optionally tag each item with how it made you feel. */
  | { kind: "react"; tags: Tags }
  /** Mark each item agree or disagree, optionally with tags. */
  | { kind: "agree"; agree: [boolean, boolean, boolean]; tags: Tags }
  /** Rank the items 1 to 3, 1 being the one you like most. */
  | { kind: "rank"; ranks: [number, number, number] };

export type Submission = {
  /** Only in sitting 0. */
  stance?: string;
  /** The items written for the round this sitting opens (sittings 0 to 4). */
  write?: Items;
  /** The response to the round revealed before this sitting (sittings 1 to 5). */
  respond?: Response;
};

export type Question = {
  text: string;
  /** New wording the recipient suggested, waiting for the initiator. */
  proposed?: string;
};

export type Conversation = {
  question: Question;
  recipientJoined: boolean;
  /** submissions[sitting][role] */
  submissions: Partial<Record<Role, Submission>>[];
};

export class TurnError extends Error {}

function partnerOf(role: Role): Role {
  return role === "initiator" ? "recipient" : "initiator";
}

const MAX_QUESTION_LENGTH = 300;
const MAX_ITEM_LENGTH = 2000;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function cleanQuestion(value: unknown): string {
  const text = cleanText(value, MAX_QUESTION_LENGTH);
  if (text === null) throw new TurnError("Invalid question");
  return text;
}

/** Wording that differs only in case or spacing counts as the same question. */
function sameWording(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

export function startConversation(question: string): Conversation {
  return { question: { text: cleanQuestion(question) }, recipientJoined: false, submissions: [] };
}

function hasSubmitted(c: Conversation, sitting: number, role: Role): boolean {
  return c.submissions[sitting]?.[role] !== undefined;
}

export function isRevealed(c: Conversation, sitting: number): boolean {
  if (sitting === 0 && c.question.proposed !== undefined) return false;
  return ROLES.every((role) => hasSubmitted(c, sitting, role));
}

/** The first sitting this person has not submitted, or SITTINGS when done. */
export function currentSitting(c: Conversation, role: Role): number {
  let sitting = 0;
  while (sitting < SITTINGS && hasSubmitted(c, sitting, role)) sitting++;
  return sitting;
}

export function isFinished(c: Conversation): boolean {
  return isRevealed(c, LAST_SITTING);
}

export type NextAction =
  | { kind: "join" }
  | { kind: "decide_question"; proposed: string }
  | { kind: "wait_for_question" }
  | { kind: "sit"; sitting: number }
  | { kind: "wait"; sitting: number }
  | { kind: "finished" };

/** What this person should do now. */
export function nextAction(c: Conversation, role: Role): NextAction {
  if (isFinished(c)) return { kind: "finished" };
  if (role === "recipient" && !c.recipientJoined) return { kind: "join" };
  if (c.question.proposed !== undefined) {
    return role === "initiator"
      ? { kind: "decide_question", proposed: c.question.proposed }
      : { kind: "wait_for_question" };
  }
  const sitting = currentSitting(c, role);
  if (sitting === SITTINGS) return { kind: "wait", sitting: LAST_SITTING };
  // You can't respond to a round until it has been revealed.
  if (sitting > 0 && !isRevealed(c, sitting - 1)) return { kind: "wait", sitting: sitting - 1 };
  return { kind: "sit", sitting };
}

/**
 * What a viewer may see of a sitting: always their own submission, and their
 * partner's only once the sitting is revealed.
 */
export function visibleSubmissions(c: Conversation, sitting: number, viewer: Role) {
  const all = c.submissions[sitting] ?? {};
  return {
    mine: all[viewer],
    partner: isRevealed(c, sitting) ? all[partnerOf(viewer)] : undefined,
  };
}

/** What the invite shows before the recipient joins: never the initiator's stance. */
export function inviteView(c: Conversation) {
  return { question: c.question.text };
}

export function join(c: Conversation, proposedQuestion?: string): Conversation {
  if (c.recipientJoined) throw new TurnError("Already joined");
  const proposed = proposedQuestion === undefined ? undefined : cleanQuestion(proposedQuestion);
  return {
    ...c,
    recipientJoined: true,
    question:
      proposed && !sameWording(proposed, c.question.text) ? { ...c.question, proposed } : c.question,
  };
}

/**
 * The initiator accepts or declines the recipient's wording. Accepting reopens
 * the initiator's opening, if written, so their stance answers the new wording.
 */
export function decideQuestion(c: Conversation, role: Role, accept: boolean): Conversation {
  const { proposed } = c.question;
  if (role !== "initiator" || proposed === undefined) {
    throw new TurnError("Nothing for this person to decide");
  }
  if (!accept) return { ...c, question: { text: c.question.text } };
  const submissions = [...c.submissions];
  if (submissions[0]) submissions[0] = { recipient: submissions[0].recipient };
  return { ...c, question: { text: proposed }, submissions };
}

const TAG = /^[a-z0-9_]{1,30}$/;
const MAX_TAGS_PER_ITEM = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function parseItems(value: unknown): Items | null {
  if (!Array.isArray(value) || value.length !== ITEMS_PER_ROUND) return null;
  const items = value.map((item) => cleanText(item, MAX_ITEM_LENGTH));
  return items.every((item) => item !== null) ? (items as Items) : null;
}

function parseTags(value: unknown): Tags | null {
  if (!Array.isArray(value) || value.length !== ITEMS_PER_ROUND) return null;
  const ok = value.every(
    (tags) =>
      Array.isArray(tags) &&
      tags.length <= MAX_TAGS_PER_ITEM &&
      new Set(tags).size === tags.length &&
      tags.every((tag) => typeof tag === "string" && TAG.test(tag)),
  );
  return ok ? (value.map((tags: string[]) => [...tags]) as Tags) : null;
}

function parseAgree(value: unknown): [boolean, boolean, boolean] | null {
  return Array.isArray(value) &&
    value.length === ITEMS_PER_ROUND &&
    value.every((a) => typeof a === "boolean")
    ? ([...value] as [boolean, boolean, boolean])
    : null;
}

function parseRanks(value: unknown): [number, number, number] | null {
  return Array.isArray(value) &&
    value.length === ITEMS_PER_ROUND &&
    value.every((r) => Number.isInteger(r) && r >= 1 && r <= ITEMS_PER_ROUND) &&
    new Set(value).size === ITEMS_PER_ROUND
    ? ([...value] as [number, number, number])
    : null;
}

const RESPONSE_FIELDS: Record<ResponseKind, string[]> = {
  rephrase: ["kind", "texts"],
  answer: ["kind", "texts", "tags"],
  react: ["kind", "tags"],
  agree: ["kind", "agree", "tags"],
  rank: ["kind", "ranks"],
};

function parseResponse(value: unknown, kind: ResponseKind): Response | null {
  if (!isRecord(value) || value.kind !== kind || !hasOnlyKeys(value, RESPONSE_FIELDS[kind])) {
    return null;
  }
  switch (kind) {
    case "rephrase": {
      const texts = parseItems(value.texts);
      return texts && { kind, texts };
    }
    case "answer": {
      const texts = parseItems(value.texts);
      const tags = parseTags(value.tags);
      return texts && tags && { kind, texts, tags };
    }
    case "react": {
      const tags = parseTags(value.tags);
      return tags && { kind, tags };
    }
    case "agree": {
      const agree = parseAgree(value.agree);
      const tags = parseTags(value.tags);
      return agree && tags && { kind, agree, tags };
    }
    case "rank": {
      const ranks = parseRanks(value.ranks);
      return ranks && { kind, ranks };
    }
  }
}

export type ParseResult =
  | { ok: true; submission: Submission }
  | { ok: false; invalid: keyof Submission | "sitting" | "shape" };

/**
 * Checks untrusted input for a sitting and returns a fresh, trimmed copy with
 * exactly the parts that sitting needs. Anything else is rejected.
 */
export function parseSubmission(sitting: number, input: unknown): ParseResult {
  if (!Number.isInteger(sitting) || sitting < 0 || sitting > LAST_SITTING) {
    return { ok: false, invalid: "sitting" };
  }
  if (!isRecord(input) || !hasOnlyKeys(input, ["stance", "write", "respond"])) {
    return { ok: false, invalid: "shape" };
  }
  const submission: Submission = {};

  if (sitting === 0) {
    const stance = cleanText(input.stance, MAX_ITEM_LENGTH);
    if (stance === null) return { ok: false, invalid: "stance" };
    submission.stance = stance;
  } else if (input.stance !== undefined) {
    return { ok: false, invalid: "stance" };
  }

  if (sitting < LAST_SITTING) {
    const write = parseItems(input.write);
    if (write === null) return { ok: false, invalid: "write" };
    submission.write = write;
  } else if (input.write !== undefined) {
    return { ok: false, invalid: "write" };
  }

  if (sitting > 0) {
    const respond = parseResponse(input.respond, ROUNDS[sitting - 1].respond.kind);
    if (respond === null) return { ok: false, invalid: "respond" };
    submission.respond = respond;
  } else if (input.respond !== undefined) {
    return { ok: false, invalid: "respond" };
  }

  return { ok: true, submission };
}

/** Records a person's submission for their current sitting. */
export function submit(c: Conversation, role: Role, sitting: number, input: unknown): Conversation {
  const action = nextAction(c, role);
  if (action.kind !== "sit" || action.sitting !== sitting) {
    throw new TurnError(`Not ${role}'s turn for sitting ${sitting}`);
  }
  const parsed = parseSubmission(sitting, input);
  if (!parsed.ok) throw new TurnError(`Invalid ${parsed.invalid}`);
  const submissions = [...c.submissions];
  submissions[sitting] = { ...submissions[sitting], [role]: parsed.submission };
  return { ...c, submissions };
}
