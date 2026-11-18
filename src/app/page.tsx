import Link from "next/link";
import { getProfile, getSignedIn } from "@/lib/auth/session";
import { DESCRIPTION, PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import form from "./form.module.css";
import styles from "./page.module.css";

export default async function Home() {
  const signedIn = await getSignedIn();
  const profile = signedIn && (await getProfile(signedIn.userId));
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{PRODUCT_NAME}</h1>
      <p className={styles.tagline}>{TAGLINE}</p>
      <p className={styles.intro}>{DESCRIPTION}</p>
      {signedIn ? (
        <form action="/auth/sign-out" method="post" className={form.form}>
          <p className={form.hint}>
            Signed in{profile ? ` as ${profile.firstName}` : ""}.
          </p>
          <button type="submit" className={form.link}>
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/sign-in" className={form.button}>
          Sign in
        </Link>
      )}
    </main>
  );
}
