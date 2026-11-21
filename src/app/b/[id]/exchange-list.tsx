import { useId } from "react";
import { feelingLabel } from "@/lib/conversation/feelings";
import type { Exchange, Response } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";

const andList = new Intl.ListFormat("en", { type: "conjunction" });
const ORDINAL_SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };
const ordinals = new Intl.PluralRules("en", { type: "ordinal" });
const ordinal = (n: number) => `${n}${ORDINAL_SUFFIX[ordinals.select(n)] ?? "th"}`;

/** Who wrote the items, or responded to them: you, or your partner by name. */
export type Who = { you: true } | { you: false; name: string };

/**
 * One person's items for a round, each with the other person's response to it.
 * Your own words are muted; your partner's keep the accent bar.
 */
export function ExchangeList({
  heading,
  level = 2,
  exchange: { items, response },
  author,
  responder,
}: {
  heading: string;
  /** The heading's level, under whatever heads the page or section it's in. */
  level?: 2 | 3;
  exchange: Exchange;
  author: Who;
  responder: Who;
}) {
  const id = useId();
  const Heading = `h${level}` as const;
  return (
    <section aria-labelledby={id} className={styles.responses}>
      <Heading id={id}>{heading}</Heading>
      {/* Safari stops announcing a list once its bullets are styled away. */}
      <ol role="list" className={styles.list}>
        {items.map((item, i) => (
          <li key={i}>
            <Words who={author} text={item} />
            <ResponseTo response={response} index={i} responder={responder} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Something a person wrote, styled and labelled by whose it is. */
export function Words({ who, text }: { who: Who; text: string }) {
  return (
    <p className={who.you ? styles.mine : styles.quote}>
      <span className={styles.visuallyHidden}>{who.you ? "You" : who.name} wrote: </span>
      {text}
    </p>
  );
}

/** One response to one item: what was written or picked, then any feelings tagged. */
function ResponseTo({ response, index, responder }: { response: Response; index: number; responder: Who }) {
  const name = responder.you ? "You" : responder.name;
  const feelings = "tags" in response ? response.tags[index] : [];
  const line = (text: string) => <p className={styles.reply}>{text}</p>;
  const agrees = responder.you ? ["agree", "don't agree"] : ["agrees", "doesn't agree"];
  return (
    <>
      {"texts" in response && <Words who={responder} text={response.texts[index]} />}
      {response.kind === "agree" && line(`${name} ${agrees[response.agree[index] ? 0 : 1]}.`)}
      {response.kind === "rank" && line(`${name} ranked this ${ordinal(response.ranks[index])} of ${ITEMS_PER_ROUND}.`)}
      {feelings.length > 0 ? (
        <p className={`${styles.hint} ${styles.reply}`}>
          It made {responder.you ? "you" : name} feel{" "}
          {andList.format(feelings.map((slug) => feelingLabel(slug).toLowerCase()))}.
        </p>
      ) : (
        response.kind === "react" && (
          <p className={`${styles.hint} ${styles.reply}`}>{name} didn&apos;t pick a feeling for this.</p>
        )
      )}
    </>
  );
}
