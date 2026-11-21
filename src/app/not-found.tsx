import type { Metadata } from "next";
import Link from "next/link";
import styles from "./form.module.css";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1>We couldn&apos;t find that page</h1>
      <div className={styles.form}>
        <p className={styles.hint}>The link may be mistyped, or it&apos;s for a Benvolio that was deleted or that you&apos;re not part of.</p>
        <Link href="/" className={styles.button}>
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
