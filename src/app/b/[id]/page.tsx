import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { nextAction, type NextAction } from "@/lib/conversation/model";
import { withNext } from "@/lib/auth/safe-next";
import { getProfile, requireSignedIn } from "@/lib/auth/session";
import { loadBenvolio } from "@/lib/db/load-benvolio";
import styles from "../../form.module.css";
import { RenewInvite } from "./renew-invite";

export const metadata: Metadata = { title: "Your Benvolio" };

function status(action: NextAction, partner: string): string {
  switch (action.kind) {
    case "join": // Only the recipient joins, and they can't see this page until they have.
      throw new Error("Unreachable: a recipient who hasn't joined can't load this page");
    case "decide_question":
      return `${partner} suggested new wording: “${action.proposed}”`;
    case "wait_for_question":
      return `Waiting for ${partner} to agree to your wording.`;
    case "sit":
      return action.sitting === 0
        ? "Your turn: write your opening."
        : `Your turn: sitting ${action.sitting + 1} of 6.`;
    case "wait":
      return `Waiting for ${partner} to write theirs.`;
    case "finished":
      return "You've finished this Benvolio.";
  }
}

/** The conversation's home. The writing screens come in the next change. */
export default async function BenvolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const here = `/b/${id}`;
  const { userId } = await requireSignedIn(here);
  const [profile, benvolio] = await Promise.all([getProfile(userId), loadBenvolio(id, userId)]);
  if (!profile) redirect(withNext("/welcome", here));
  if (!benvolio) notFound();
  const { conversation, role, partnerName } = benvolio;
  return (
    <main className={styles.main}>
      <p className={styles.hint}>With {partnerName}</p>
      <h1>{conversation.question.text}</h1>
      {role === "initiator" && !conversation.recipientJoined && (
        <>
          <p>{partnerName} hasn&apos;t accepted your invite yet.</p>
          <RenewInvite benvolioId={id} partnerName={partnerName} />
        </>
      )}
      <p>{status(nextAction(conversation, role), partnerName)}</p>
    </main>
  );
}
