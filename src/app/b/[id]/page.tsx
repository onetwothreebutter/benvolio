import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  hasSubmitted,
  nextAction,
  partnerOf,
  visibleSubmissions,
  type Conversation,
  type Role,
} from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { withNext } from "@/lib/auth/safe-next";
import { getProfile, requireSignedIn } from "@/lib/auth/session";
import { loadBenvolio } from "@/lib/db/load-benvolio";
import { Masthead } from "../../masthead";
import { PersonMark } from "../../person-mark";
import styles from "../../form.module.css";
import { DecideQuestion } from "./decide-question";
import { RenewInvite } from "./renew-invite";
import { SittingForm, type Revealed } from "./sitting-form";

export const metadata: Metadata = { title: "Your Benvolio" };

/** The conversation's home: what happens next, and where each sitting is written. */
export default async function BenvolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const here = `/b/${id}`;
  const { userId } = await requireSignedIn(here);
  const [profile, benvolio] = await Promise.all([getProfile(userId), loadBenvolio(id, userId)]);
  if (!profile) redirect(withNext("/welcome", here));
  if (!benvolio) notFound();
  const { conversation, role, partnerName } = benvolio;
  const action = nextAction(conversation, role);
  return (
    <main className={styles.main}>
      <Masthead />
      <PersonMark name={partnerName} role={partnerOf(role)}>
        With {partnerName}
      </PersonMark>
      <h1 className={styles.question}>{conversation.question.text}</h1>
      {role === "initiator" && !conversation.recipientJoined && (
        <>
          <p>{partnerName} hasn&apos;t accepted your invite yet.</p>
          <RenewInvite benvolioId={id} partnerName={partnerName} />
        </>
      )}
      <p className={styles.status}>{statusLine(action, partnerName)}</p>
      {action.kind === "decide_question" && (
        <DecideQuestion
          benvolioId={id}
          proposed={action.proposed}
          openingWritten={hasSubmitted(conversation, 0, "initiator")}
        />
      )}
      {action.kind === "sit" && (
        <SittingForm
          benvolioId={id}
          sitting={action.sitting}
          partnerName={partnerName}
          question={conversation.question.text}
          revealed={revealedFor(conversation, action.sitting, role)}
        />
      )}
    </main>
  );
}

/** What the partner wrote for the round this sitting responds to, if any. */
function revealedFor(c: Conversation, sitting: number, role: Role): Revealed | undefined {
  if (sitting === 0) return undefined;
  const partner = visibleSubmissions(c, sitting - 1, role).partner;
  // A sitting is only ever your turn once the one before it is revealed.
  if (!partner?.write) throw new Error(`Sitting ${sitting - 1} isn't revealed`);
  return { items: partner.write, stance: partner.stance, by: partnerOf(role) };
}
