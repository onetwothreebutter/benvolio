import type { Metadata } from "next";
import styles from "../../form.module.css";
import { confirmSignIn } from "./actions";

// The token is in this page's address, so never send it on as a Referer.
export const metadata: Metadata = { title: "Sign in", referrer: "no-referrer" };

/**
 * The link in the sign-in email lands here. Signing in takes a tap rather than
 * happening on load, because email security scanners open links (but don't
 * submit forms), and opening would otherwise use up the one-time token before
 * the person gets to it.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash = "" } = await searchParams;
  return (
    <main className={styles.main}>
      <h1>Sign in to Benvolio</h1>
      <form action={confirmSignIn} className={styles.form}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <button type="submit" className={styles.button}>
          Continue
        </button>
      </form>
    </main>
  );
}
