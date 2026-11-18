import { DESCRIPTION, PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{PRODUCT_NAME}</h1>
      <p className={styles.tagline}>{TAGLINE}</p>
      <p className={styles.intro}>{DESCRIPTION}</p>
    </main>
  );
}
