import { ITEMS_PER_ROUND, ROUNDS } from "./rounds";

/**
 * The turn-taking rules of a Benvolio, as pure functions over plain data.
 *
 * Each person sits down six times. Sitting 0 is the opening: your stance and
 * three reasons. In sittings 1 to 4 you respond to the round your partner just
 * revealed and write your part of the next round. Sitting 5 is the last
 * response. A sitting is revealed to both people only once both have submitted
 * it, so neither ever sees the other's writing for a sitting before writing
 * their own.
 */

export type Role = "initiator" | "recipient";
export const ROLES: readonly Role[] = ["initiator", "recipient"];

export const LAST_SITTING = ROUNDS.length; // 5
export const SITTINGS = LAST_SITTING + 1; // 6

export type Items = [string, string, string];
export type Tags = [string[], string[], string[]];

export type Response =
  | { kind: "rephrase"; texts: Items }
  | { kind: "answer"; texts: Items; tags: Tags }
  | { kind: "react"; tags: Tags }
  | { kind: "agree"; agree: [boolean, boolean, boolean]; tags: Tags }
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

export function partnerOf(role: Role): Role {
  return role === "initiator" ? "recipient" : "initiator";
}

/** The round whose items a sitting writes, if any. */
export function roundWrittenIn(sitting: number) {
  return sitting < LAST_SITTING ? ROUNDS[sitting] : undefined;
}

/** The round a sitting responds to, if any. */
export function roundRespondedIn(sitting: number) {
  return sitting > 0 ? ROUNDS[sitting - 1] : undefined;
}

export function startConversation(question: string): Conversation {
  return { question: { text: question.trim() }, recipientJoined: false, submissions: [] };
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
  | { kind: "sit"; sitting: number }
  | { kind: "wait"; sitting: number }
  | { kind: "finished" };

/** What this person should do now. */
export function nextAction(c: Conversation, role: Role): NextAction {
  if (isFinished(c)) return { kind: "finished" };
  if (role === "recipient" && !c.recipientJoined) return { kind: "join" };
  if (role === "initiator" && c.question.proposed !== undefined) {
    return { kind: "decide_question", proposed: c.question.proposed };
  }
  const sitting = currentSitting(c, role);
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
  const partner = partnerOf(viewer);
  return {
    mine: all[viewer],
    partner: isRevealed(c, sitting) ? all[partner] : undefined,
  };
}

/** What the invite shows before the recipient joins: never the initiator's stance. */
export function inviteView(c: Conversation) {
  return { question: c.question.text };
}

export class TurnError extends Error {}

export function join(c: Conversation, proposedQuestion?: string): Conversation {
  if (c.recipientJoined) throw new TurnError("Already joined");
  const proposed = proposedQuestion?.trim();
  return {
    ...c,
    recipientJoined: true,
    question:
      proposed && proposed !== c.question.text ? { ...c.question, proposed } : c.question,
  };
}

export function decideQuestion(c: Conversation, accept: boolean): Conversation {
  const { proposed } = c.question;
  if (proposed === undefined) throw new TurnError("No wording to decide on");
  return { ...c, question: { text: accept ? proposed : c.question.text } };
}

const TAG = /^[a-z0-9_]{1,30}$/;
const MAX_TAGS_PER_ITEM = 3;
export const MAX_ITEM_LENGTH = 2000;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_ITEM_LENGTH;
}

function isItems(value: unknown): value is Items {
  return Array.isArray(value) && value.length === ITEMS_PER_ROUND && value.every(isText);
}

function isTags(value: unknown): value is Tags {
  return (
    Array.isArray(value) &&
    value.length === ITEMS_PER_ROUND &&
    value.every(
      (tags) =>
        Array.isArray(tags) &&
        tags.length <= MAX_TAGS_PER_ITEM &&
        tags.every((tag) => typeof tag === "string" && TAG.test(tag)),
    )
  );
}

function isResponse(value: Response | undefined, kind: string): boolean {
  if (!value || value.kind !== kind) return false;
  switch (value.kind) {
    case "rephrase":
      return isItems(value.texts);
    case "answer":
      return isItems(value.texts) && isTags(value.tags);
    case "react":
      return isTags(value.tags);
    case "agree":
      return (
        Array.isArray(value.agree) &&
        value.agree.length === ITEMS_PER_ROUND &&
        value.agree.every((a) => typeof a === "boolean") &&
        isTags(value.tags)
      );
    case "rank":
      return (
        Array.isArray(value.ranks) &&
        value.ranks.every(Number.isInteger) &&
        [...value.ranks].sort().join(",") === "1,2,3"
      );
  }
}

/** Checks a submission has exactly the parts its sitting needs, all filled in. */
export function validateSubmission(sitting: number, s: Submission): string | null {
  const writes = roundWrittenIn(sitting);
  const responds = roundRespondedIn(sitting);
  if (sitting === 0 ? !isText(s.stance) : s.stance !== undefined) return "stance";
  if (writes ? !isItems(s.write) : s.write !== undefined) return "write";
  if (responds ? !isResponse(s.respond, responds.respond.kind) : s.respond !== undefined) {
    return "respond";
  }
  return null;
}

/** Records a person's submission for their current sitting. */
export function submit(
  c: Conversation,
  role: Role,
  sitting: number,
  submission: Submission,
): Conversation {
  const action = nextAction(c, role);
  if (action.kind !== "sit" || action.sitting !== sitting) {
    throw new TurnError(`Not ${role}'s turn for sitting ${sitting}`);
  }
  const invalid = validateSubmission(sitting, submission);
  if (invalid) throw new TurnError(`Invalid ${invalid}`);
  const submissions = [...c.submissions];
  submissions[sitting] = { ...submissions[sitting], [role]: submission };
  return { ...c, submissions };
}
