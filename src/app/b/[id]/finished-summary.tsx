import type { Summary, SummaryItem } from "@/lib/conversation/model";
import styles from "../../form.module.css";
import { PrintButton } from "./print-button";
import { ItemList, ResponsesSection } from "./responses-section";

/** What both people keep once a Benvolio is finished: common ground first, then compromises. */
export function FinishedSummary({ summary, partnerName }: { summary: Summary; partnerName: string }) {
  const { agreed, differ, compromises, stances } = summary;
  /** Who wrote a point, and whether the other person agreed with it. */
  const marked = (agreed: boolean) => (item: SummaryItem) =>
    item.mine
      ? `You wrote this. ${partnerName} ${agreed ? "agreed" : "didn't agree"}.`
      : `${partnerName} wrote this. You ${agreed ? "agreed" : "didn't agree"}.`;
  return (
    <>
      <ResponsesSection id="summary-agreed" title="What you agree on">
        {agreed.length > 0 ? (
          <Items items={agreed} note={marked(true)} />
        ) : (
          <p className={styles.hint}>Neither of you agreed with the other&apos;s points this time.</p>
        )}
      </ResponsesSection>

      {compromises && (
        <ResponsesSection id="summary-compromises" title="Compromises">
          <h3>The ones you each liked most</h3>
          <Items
            items={[
              { text: compromises.partner[0], mine: false },
              { text: compromises.mine[0], mine: true },
            ]}
            note={(item) =>
              item.mine ? `Your idea ${partnerName} liked most` : `${partnerName}'s idea you liked most`
            }
          />
          <Ranked title={`All of ${partnerName}'s, as you ranked them`} items={compromises.partner} />
          <Ranked title={`All of yours, as ${partnerName} ranked them`} items={compromises.mine} />
        </ResponsesSection>
      )}

      {differ.length > 0 && (
        <ResponsesSection id="summary-differ" title="Still to talk about">
          <Items items={differ} note={marked(false)} />
        </ResponsesSection>
      )}

      <ResponsesSection id="summary-stances" title="Where you each started">
        <Items items={stances} note={(item) => (item.mine ? "Your view" : `${partnerName}'s view`)} />
      </ResponsesSection>

      <PrintButton />
    </>
  );
}

/** Items quoted as written, each with a line saying whose it is or what became of it. */
function Items({ items, note }: { items: SummaryItem[]; note: (item: SummaryItem) => string }) {
  return (
    <ItemList>
      {items.map((item, i) => (
        <li key={i}>
          <p className={item.mine ? styles.mine : styles.quote}>{item.text}</p>
          <p className={`${styles.hint} ${styles.reply}`}>{note(item)}</p>
        </li>
      ))}
    </ItemList>
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
