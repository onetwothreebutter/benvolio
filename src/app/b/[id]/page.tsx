import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { nextAction } from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { withNext } from "@/lib/auth/safe-next";
import { getProfile, requireSignedIn } from "@/lib/auth/session";
import { loadBenvolio } from "@/lib/db/load-benvolio";
import styles from "../../form.module.css";
import { RenewInvite } from "./renew-invite";

export const metadata: Metadata = { title: "Your Benvolio" };

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
      <p>{statusLine(nextAction(conversation, role), partnerName)}</p>
    </main>
  );
}
