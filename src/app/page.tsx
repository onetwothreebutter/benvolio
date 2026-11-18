import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Benvolio</h1>
      <p className={styles.tagline}>Talk. Listen. Learn.</p>
      <p className={styles.intro}>
        Benvolio helps people with different opinions have a structured
        conversation to better understand each other and discover common
        ground.
      </p>
    </main>
  );
}
