"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { normalizeEmail } from "@/lib/auth/email";
import { rememberNext, takeNext } from "@/lib/auth/next-cookie";
import { safeNext, withNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { step: "email" | "code"; email?: string; error?: string };

const CODE = /^\d{6,10}$/;

/**
 * Step 1 emails a one-time code (and a link, for whoever prefers it). Step 2
 * checks the code. A code works on whichever phone or browser it is typed into,
 * unlike a link, which email apps often open in their own browser.
 *
 * `state` comes back from the browser, so nothing in it is trusted.
 */
export async function signIn(state: SignInState, form: FormData): Promise<SignInState> {
  if (form.get("restart") === "1") return { step: "email" };
  const next = safeNext(form.get("next"));
  return state.step === "code" ? checkCode(state.email, form, next) : sendCode(form, next);
}

async function sendCode(form: FormData, next: string): Promise<SignInState> {
  const typed = String(form.get("email") ?? "");
  const email = normalizeEmail(typed);
  if (!email) {
    return { step: "email", email: typed, error: "That doesn't look like an email address." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const tooMany = error.status === 429;
    // Supabase's message names the cause (SMTP refused, template error) and
    // never includes the address, so it is safe to report.
    if (!tooMany) Sentry.captureMessage(`Sign-in email failed: ${error.status} ${error.message}`, "error");
    return {
      step: "email",
      email,
      error: tooMany
        ? "Too many tries. Please wait a minute, then try again."
        : "We couldn't send the email. Please try again.",
    };
  }
  await rememberNext(next);
  return { step: "code", email };
}

async function checkCode(stateEmail: unknown, form: FormData, next: string): Promise<SignInState> {
  const email = normalizeEmail(stateEmail);
  if (!email) return { step: "email" };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!CODE.test(code)) return { step: "code", email, error: "Enter the code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) return { step: "code", email, error: "That code didn't work. It may have expired." };
  await takeNext(); // The link is no longer needed.
  // /welcome asks new people their name and passes everyone else straight on.
  redirect(withNext("/welcome", next));
}
