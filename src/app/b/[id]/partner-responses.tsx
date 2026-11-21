import { feelingLabel } from "@/lib/conversation/feelings";
import type { Exchange, Response } from "@/lib/conversation/model";
import { ROUNDS } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";

const PLACES = ["first", "second", "third"];
const andList = new Intl.ListFormat("en", { type: "conjunction" });

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
    <section aria-labelledby={id} className={styles.form}>
      <h2 id={id} className={styles.label}>
        {ROUNDS[round - 1].respond.seen(partnerName)}
      </h2>
      <ol className={styles.list}>
        {items.map((item, i) => (
          <li key={i} className={styles.form}>
            <p className={styles.quote}>{item}</p>
            <ResponseTo response={response} index={i} partnerName={partnerName} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the partner said about one item, in words. */
function reply(response: Response, index: number, partnerName: string): string | undefined {
  switch (response.kind) {
    case "rephrase":
    case "answer":
      return response.texts[index];
    case "react":
      return undefined;
    case "agree":
      return `${partnerName} ${response.agree[index] ? "agrees" : "doesn't agree"}.`;
    case "rank":
      return `${partnerName}'s ${PLACES[response.ranks[index] - 1]} choice.`;
  }
}

/** The partner's response to one item: their words, then any feelings they tagged. */
function ResponseTo({ response, index, partnerName }: { response: Response; index: number; partnerName: string }) {
  const text = reply(response, index, partnerName);
  const feelings = "tags" in response ? response.tags[index] : [];
  return (
    <>
      {text && <p className={styles.reply}>{text}</p>}
      {feelings.length > 0 ? (
        <p className={styles.hint}>
          It made {partnerName} feel {andList.format(feelings.map((slug) => feelingLabel(slug).toLowerCase()))}.
        </p>
      ) : (
        response.kind === "react" && <p className={styles.hint}>{partnerName} read this.</p>
      )}
    </>
  );
}
