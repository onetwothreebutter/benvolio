import type { ReactNode } from "react";
import type { Summary, SummaryItem } from "@/lib/conversation/model";
import styles from "../../form.module.css";
import { PrintButton } from "./print-button";

/** What both people keep once a Benvolio is finished: common ground first, then compromises. */
export function FinishedSummary({ summary, partnerName }: { summary: Summary; partnerName: string }) {
  const { agreed, differ, compromises, stances } = summary;
  const byWhom = (item: SummaryItem) => (item.mine ? "You wrote this" : `${partnerName} wrote this`);
  return (
    <>
      <Section title="What you agree on">
        {agreed.length > 0 ? (
          <Items items={agreed} note={byWhom} />
        ) : (
          <p className={styles.hint}>Neither of you agreed with the other&apos;s points this time.</p>
        )}
      </Section>

      <Section title="The compromises you each liked most">
        <ol role="list" className={styles.list}>
          <li>
            <p className={styles.quote}>{compromises.partner[0]}</p>
            <p className={`${styles.hint} ${styles.reply}`}>Your first choice of {partnerName}&apos;s</p>
          </li>
          <li>
            <p className={styles.quote}>{compromises.mine[0]}</p>
            <p className={`${styles.hint} ${styles.reply}`}>{partnerName}&apos;s first choice of yours</p>
          </li>
        </ol>
        <Ranked title={`All of ${partnerName}'s, as you ranked them`} items={compromises.partner} />
        <Ranked title={`All of yours, as ${partnerName} ranked them`} items={compromises.mine} />
      </Section>

      {differ.length > 0 && (
        <Section title="Still to talk about">
          <p className={styles.hint}>Points one of you didn&apos;t agree with.</p>
          <Items items={differ} note={byWhom} />
        </Section>
      )}

      <Section title="Where you each started">
        <Items
          items={[
            { text: stances.mine, mine: true },
            { text: stances.partner, mine: false },
          ]}
          note={(item) => (item.mine ? "Your view" : `${partnerName}'s view`)}
        />
      </Section>

      <PrintButton />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `summary-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={styles.responses}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Items({ items, note }: { items: SummaryItem[]; note: (item: SummaryItem) => string }) {
  return (
    // Safari stops announcing a list once its bullets are styled away.
    <ul role="list" className={styles.list}>
      {items.map((item, i) => (
        <li key={i}>
          <p className={item.mine ? styles.mine : styles.quote}>{item.text}</p>
          <p className={`${styles.hint} ${styles.reply}`}>{note(item)}</p>
        </li>
      ))}
    </ul>
  );
}

function Ranked({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <>
      <h3>{title}</h3>
      <ol className={styles.ranked}>
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ol>
    </>
  );
}
