"use client";

import { useActionState } from "react";
import { MAX_FIRST_NAME_LENGTH } from "@/lib/people/first-name";
import styles from "../form.module.css";
import { saveFirstName, type WelcomeState } from "./actions";

export function WelcomeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(saveFirstName, {});
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="first_name" className={styles.label}>
        Your first name
      </label>
      <input
        id="first_name"
        name="first_name"
        autoComplete="given-name"
        maxLength={MAX_FIRST_NAME_LENGTH}
        required
        className={styles.input}
      />
      <p className={styles.hint}>This is how you&apos;ll appear to the people you talk with.</p>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        Continue
      </button>
    </form>
  );
}
