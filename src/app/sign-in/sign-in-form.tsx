"use client";

import { useActionState } from "react";
import styles from "../form.module.css";
import { signIn, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {
    step: "email",
  });

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      {state.step === "email" ? (
        <>
          <label htmlFor="email" className={styles.label}>
            Your email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            className={styles.input}
          />
          <p className={styles.hint}>We&apos;ll email you a code. No password needed.</p>
        </>
      ) : (
        <>
          <label htmlFor="code" className={styles.label}>
            The code we sent to {state.email}
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className={styles.input}
          />
        </>
      )}
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        {state.step === "email" ? "Email me a code" : "Sign in"}
      </button>
      {state.step === "code" && (
        <button type="submit" name="restart" value="1" formNoValidate className={styles.link}>
          Use a different email
        </button>
      )}
    </form>
  );
}
