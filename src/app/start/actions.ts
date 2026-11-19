"use server";

import { cleanQuestion, TurnError } from "@/lib/conversation/model";
import { normalizeEmail } from "@/lib/auth/email";
import { requirePerson } from "@/lib/auth/session";
import { newInviteToken } from "@/lib/invites/token";
import { cleanFirstName } from "@/lib/people/first-name";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/** What was typed, sent back with an error so the form can show it again. */
export type StartValues = {
  question: string;
  partnerName: string;
  partnerEmail: string;
  pace: "daily" | "weekly";
};

export type StartState =
  | { done?: false; error?: string; values?: StartValues }
  | { done: true; benvolioId: string; inviteUrl: string; partnerName: string };

export async function startBenvolio(_state: StartState, form: FormData): Promise<StartState> {
  const person = await requirePerson("/start");
  const pace = form.get("pace") === "weekly" ? "weekly" : "daily";
  // React clears the form after every submit, so errors carry the typed values back.
  const values: StartValues = {
    question: String(form.get("question") ?? ""),
    partnerName: String(form.get("partner_name") ?? ""),
    partnerEmail: String(form.get("partner_email") ?? ""),
    pace,
  };
  const retry = (error: string): StartState => ({ error, values });
  let question: string;
  try {
    question = cleanQuestion(form.get("question"));
  } catch (e) {
    if (!(e instanceof TurnError)) throw e;
    return retry("Please write the question you'd like to talk about.");
  }
  const partnerName = cleanFirstName(form.get("partner_name"));
  if (!partnerName) return retry("Please enter their first name.");
  const partnerEmail = normalizeEmail(form.get("partner_email"));
  if (!partnerEmail) return retry("Please enter their email address.");
  if (partnerEmail === normalizeEmail(person.email)) {
    return retry("That's your own email. Enter the email of the person you're inviting.");
  }

  const { token, hash } = newInviteToken();
  const { data, error } = await createAdminClient().rpc("start_benvolio", {
    initiator: person.userId,
    question,
    partner_first_name: partnerName,
    partner_email: partnerEmail,
    token_hash: hash,
    pace,
  });
  if (error) throw new Error(`Starting a Benvolio failed: ${error.message}`);

  return {
    done: true,
    benvolioId: data as string,
    inviteUrl: `${siteUrl()}/join/${token}`,
    partnerName,
  };
}
