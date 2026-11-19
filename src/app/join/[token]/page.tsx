import type { Metadata } from "next";
import Link from "next/link";
import { getSignedIn, requirePerson } from "@/lib/auth/session";
import { withNext } from "@/lib/auth/safe-next";
import { findInvite, type OpenInvite } from "@/lib/invites/lookup";
import { INVITE_GONE, OWN_INVITE } from "@/lib/invites/messages";
import styles from "../../form.module.css";
import { JoinForm } from "./join-form";

// The token is in this page's address, so never send it on as a Referer.
export const metadata: Metadata = { title: "You're invited", referrer: "no-referrer" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, signedIn] = await Promise.all([findInvite(token), getSignedIn()]);
  return <main className={styles.main}>{await body(token, invite, signedIn?.userId)}</main>;
}

async function body(token: string, invite: OpenInvite | null, userId?: string) {
  const here = `/join/${token}`;
  if (!invite) {
    return (
      <>
        <h1>{INVITE_GONE}</h1>
        <p className={styles.hint}>Ask the person who sent it for a new one.</p>
      </>
    );
  }
  if (userId === invite.initiatorId) return <h1>{OWN_INVITE}</h1>;

  const intro = (
    <>
      <h1>{invite.initiatorName} would like to talk with you</h1>
      <p className={styles.hint}>
        Benvolio is a conversation in turns, over a few days. Each of you writes privately, and you
        see each other&apos;s answers only once you&apos;ve both written yours.
      </p>
    </>
  );
  if (!userId) {
    return (
      <>
        {intro}
        <div className={styles.form}>
          <p>
            <strong>{invite.question}</strong>
          </p>
          <Link href={withNext("/sign-in", here)} className={styles.button}>
            Sign in to join
          </Link>
        </div>
      </>
    );
  }
  await requirePerson(here); // New people give their name first.
  return (
    <>
      {intro}
      <JoinForm token={token} question={invite.question} />
    </>
  );
}
