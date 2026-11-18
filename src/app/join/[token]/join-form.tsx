"use client";

import { useActionState } from "react";
import { MAX_QUESTION_LENGTH } from "@/lib/conversation/model";
import styles from "../../form.module.css";
import { joinBenvolio, type JoinState } from "./actions";

export function JoinForm({ token, question }: { token: string; question: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinBenvolio, {});
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      <label htmlFor="question" className={styles.label}>
        The question
      </label>
      <textarea
        id="question"
        name="question"
        rows={3}
        maxLength={MAX_QUESTION_LENGTH}
        defaultValue={question}
        className={styles.input}
      />
      <p className={styles.hint}>
        If it doesn&apos;t sit right with you, reword it. They&apos;ll be asked to agree before
        either of you sees the other&apos;s answers.
      </p>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        Join
      </button>
    </form>
  );
}
