import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/copy";
import styles from "./masthead.module.css";

/** The name at the top of every page but home, which sets it large instead. */
export function Masthead() {
  return (
    <header className={styles.masthead}>
      <Link href="/" className={styles.wordmark}>
        {PRODUCT_NAME}
      </Link>
    </header>
  );
}
