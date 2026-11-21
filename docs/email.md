# Email

Benvolio emails people when it's their turn, so nobody has to keep checking.
Sign-in codes are sent by Supabase Auth (see `auth.md`); everything else is
sent by the app through [Resend](https://resend.com)'s API, from
`hello@mail.benvolio.app`.

| Email | Sent to | When |
| --- | --- | --- |
| Your turn, with writing to read | The partner | Someone sends a sitting their partner already sent, so both can read it |
| Your turn, partner waiting | The partner | Someone sends a sitting their partner hasn't written yet, or the initiator keeps their wording after writing their own opening |
| Your turn, ready to begin | The partner | The recipient joins, or the question is settled, and nobody has written yet |
| New wording suggested | The initiator | The recipient joins and suggests new wording for the question |
| Finished | The partner | Someone sends the last sitting |

After each change (sending a sitting, joining, deciding on the question),
`notifyLater` in `src/lib/email/notify.ts` reloads the Benvolio and emails
the other person if it's now their turn (see `turnNotice`). It runs after the page responds, so sending a sitting never
waits on email, and a failure goes to Sentry instead of the person.

## Rules

- **Never quote anyone's writing**, the question included. An inbox is less
  private than the app: emails name the partner and link to the Benvolio.
- **At most once.** Each email claims its row in `public.notifications` before
  it is sent; the table's unique key means a repeat sends nothing. If Resend
  refuses it (or doesn't answer within 10 seconds), the row is deleted so a
  later attempt can send it. For now nothing retries it, so a failed send is
  lost (the daily check-in will retry). Resend's idempotency key covers a
  retry within 24 hours of a timeout.
- **One "your turn" per sitting.** Whichever reason comes first is the one
  sent: after "ready to begin", the partner's opening sends nothing more.
- **Off without `RESEND_API_KEY`**, as in local development and the E2E suite.

## Previewing

The templates in `src/lib/email/templates.ts` are plain functions, so a
preview is one call: for example, `yourTurnEmail({ partner: "Jane", sitting: 2,
link, why: "readable" }).html`.
