import type { Role } from "@/lib/conversation/model";
import styles from "./person-mark.module.css";

/**
 * A person's initial in their ink, beside a line about them. Inks follow the
 * role, not who is looking, so both phones show each person the same way.
 */
export function PersonMark({
  name,
  role,
  children,
}: {
  name: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <p className={styles.row}>
      <span className={`${styles.mark} ${styles[role]}`} aria-hidden="true">
        {Array.from(name)[0]?.toLocaleUpperCase()}
      </span>
      <span>{children}</span>
    </p>
  );
}
