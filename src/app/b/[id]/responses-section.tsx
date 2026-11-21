import type { ReactNode } from "react";
import styles from "../../form.module.css";

/** A titled section of what was written, set apart from what follows it. */
export function ResponsesSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={styles.responses}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** A list of written items: Safari stops announcing a list once its bullets are styled away. */
export function ItemList({ children }: { children: ReactNode }) {
  return (
    <ol role="list" className={styles.list}>
      {children}
    </ol>
  );
}
