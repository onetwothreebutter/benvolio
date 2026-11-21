import { feelingLabel } from "@/lib/conversation/feelings";
import type { Exchange, Response } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND, ROUNDS } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";

const andList = new Intl.ListFormat("en", { type: "conjunction" });
const ORDINAL_SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };
const ordinals = new Intl.PluralRules("en", { type: "ordinal" });
const ordinal = (n: number) => `${n}${ORDINAL_SUFFIX[ordinals.select(n)] ?? "th"}`;

/** How the partner responded to this person's items in a round (numbered from 1). */
export function PartnerResponses({
  exchange: { round, items, response },
  partnerName,
}: {
  exchange: Exchange & { round: number };
  partnerName: string;
}) {
  const id = `responses-${round}`;
  return (
    <section aria-labelledby={id} className={styles.responses}>
      <h2 id={id} className={styles.label}>
        {ROUNDS[round - 1].respond.seen(partnerName)}
      </h2>
      {/* Safari stops announcing a list once its bullets are styled away. */}
      <ol role="list" className={styles.list}>
        {items.map((item, i) => (
          <li key={i} className={styles.form}>
            <p className={styles.mine}>
              <span className={styles.visuallyHidden}>You wrote: </span>
              {item}
            </p>
            <ResponseTo response={response} index={i} partnerName={partnerName} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The partner's response to one item: what they wrote or picked, then any feelings they tagged. */
function ResponseTo({ response, index, partnerName }: { response: Response; index: number; partnerName: string }) {
  const feelings = "tags" in response ? response.tags[index] : [];
  return (
    <>
      {"texts" in response && (
        <p className={styles.quote}>
          <span className={styles.visuallyHidden}>{partnerName}: </span>
          {response.texts[index]}
        </p>
      )}
      {response.kind === "agree" && (
        <p className={styles.reply}>
          {partnerName} {response.agree[index] ? "agrees" : "doesn't agree"}.
        </p>
      )}
      {response.kind === "rank" && (
        <p className={styles.reply}>
          {partnerName} ranked this {ordinal(response.ranks[index])} of {ITEMS_PER_ROUND}.
        </p>
      )}
      {feelings.length > 0 ? (
        <p className={styles.hint}>
          It made {partnerName} feel {andList.format(feelings.map((slug) => feelingLabel(slug).toLowerCase()))}.
        </p>
      ) : (
        response.kind === "react" && <p className={styles.hint}>{partnerName} didn&apos;t pick a feeling for this.</p>
      )}
    </>
  );
}
