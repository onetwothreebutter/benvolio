"use client";

import styles from "../../form.module.css";

/** Lets someone keep the summary: print it, or save it as a PDF from the print dialog. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${styles.button} ${styles.noPrint}`}>
      Print or save as PDF
    </button>
  );
}
