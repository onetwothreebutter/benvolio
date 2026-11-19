"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MAX_QUESTION_LENGTH } from "@/lib/conversation/model";
import { MAX_FIRST_NAME_LENGTH } from "@/lib/people/first-name";
import styles from "../form.module.css";
import { InviteLink } from "../invite-link";
import { startBenvolio, type StartState } from "./actions";

export function StartForm() {
  const [state, action, pending] = useActionState<StartState, FormData>(startBenvolio, {});
  if (state.done) return <Invite {...state} />;
  const values = state.values;
  const pace = values?.pace ?? "daily";

  return (
    <form action={action} className={styles.form}>
      <label htmlFor="question" className={styles.label}>
        What would you like to talk about?
      </label>
      <textarea
        id="question"
        name="question"
        rows={3}
        maxLength={MAX_QUESTION_LENGTH}
        required
        defaultValue={values?.question}
        placeholder="Should we move closer to family?"
        className={styles.input}
      />
      <p className={styles.hint}>
        Ask it as a question. They can suggest new wording before you start.
      </p>

      <label htmlFor="partner_name" className={styles.label}>
        Their first name
      </label>
      <input
        id="partner_name"
        name="partner_name"
        maxLength={MAX_FIRST_NAME_LENGTH}
        defaultValue={values?.partnerName}
        required
        className={styles.input}
      />

      <label htmlFor="partner_email" className={styles.label}>
        Their email
      </label>
      <input
        id="partner_email"
        name="partner_email"
        type="email"
        required
        defaultValue={values?.partnerEmail}
        className={styles.input}
      />

      <fieldset className={styles.form}>
        <legend className={styles.label}>How often should we nudge you both?</legend>
        <label>
          <input type="radio" name="pace" value="daily" defaultChecked={pace === "daily"} /> Every day
        </label>
        <label>
          <input type="radio" name="pace" value="weekly" defaultChecked={pace === "weekly"} /> Every week
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        Start
      </button>
    </form>
  );
}

function Invite({ benvolioId, inviteUrl, partnerName }: Extract<StartState, { done: true }>) {
  return (
    <div className={styles.form}>
      <h2>Now invite {partnerName}</h2>
      <InviteLink url={inviteUrl} partnerName={partnerName} />
      <Link href={`/b/${benvolioId}`} className={styles.link}>
        Go to your Benvolio
      </Link>
    </div>
  );
}
