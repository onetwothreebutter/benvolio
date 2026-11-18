import Link from "next/link";
import { getProfile, getSignedIn } from "@/lib/auth/session";
import { DESCRIPTION, PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import { myBenvolios } from "@/lib/db/my-benvolios";
import form from "./form.module.css";
import styles from "./page.module.css";

export default async function Home() {
  const signedIn = await getSignedIn();
  const [profile, benvolios] = signedIn
    ? await Promise.all([getProfile(signedIn.userId), myBenvolios()])
    : [null, []];
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{PRODUCT_NAME}</h1>
      <p className={styles.tagline}>{TAGLINE}</p>
      {!signedIn && <p className={styles.intro}>{DESCRIPTION}</p>}
      {signedIn ? (
        <>
          {benvolios.length > 0 && (
            <ul className={styles.list}>
              {benvolios.map((b) => (
                <li key={b.id}>
                  <Link href={`/b/${b.id}`}>{b.question}</Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/start" className={form.button}>
            Start a Benvolio
          </Link>
          <form action="/auth/sign-out" method="post" className={form.form}>
            <p className={form.hint}>Signed in{profile ? ` as ${profile.firstName}` : ""}.</p>
            <button type="submit" className={form.link}>
              Sign out
            </button>
          </form>
        </>
      ) : (
        <Link href="/sign-in" className={form.button}>
          Sign in
        </Link>
      )}
    </main>
  );
}
