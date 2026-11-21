import type { Metadata } from "next";
import Link from "next/link";
import { exchange, LAST_SITTING, partnerOf, visibleSubmissions } from "@/lib/conversation/model";
import { ROUNDS } from "@/lib/conversation/rounds";
import styles from "../../../form.module.css";
import { ExchangeList, Words, type Who } from "../exchange-list";
import { loadBenvolioPage } from "../load-page";

export const metadata: Metadata = { title: "Every round so far" };

/** Every round both people have responded to, both ways, from the opening on. */
export default async function RoundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = `/b/${id}`;
  const { conversation, role, partnerName } = await loadBenvolioPage(id, `${home}/rounds`);
  const you: Who = { you: true };
  const partner: Who = { you: false, name: partnerName };
  const opening = visibleSubmissions(conversation, 0, role);
  const rounds = ROUNDS.flatMap((round, i) => {
    const number = i + 1;
    const yours = exchange(conversation, number, role);
    const theirs = exchange(conversation, number, partnerOf(role));
    return yours && theirs ? [{ number, round, yours, theirs }] : [];
  });

  return (
    <main className={styles.main}>
      <p className={styles.hint}>With {partnerName}</p>
      <h1>{conversation.question.text}</h1>
      <p>
        <Link href={home} className={styles.link}>
          Back to your Benvolio
        </Link>
      </p>
      {opening.partner && (
        <section aria-labelledby="stances" className={styles.apart}>
          <h2 id="stances">Where you each stand</h2>
          <Words who={you} text={opening.mine!.stance!} />
          <Words who={partner} text={opening.partner.stance!} />
        </section>
      )}
      {rounds.length === 0 && <p>Each round appears here once you&apos;ve both responded to it.</p>}
      {rounds.map(({ number, round, yours, theirs }) => (
        <section key={number} aria-labelledby={`round-${number}`} className={styles.apart}>
          <h2 id={`round-${number}`}>
            Round {number} of {LAST_SITTING}: {round.title}
          </h2>
          <ExchangeList
            level={3}
            heading={round.respond.seen(partnerName)}
            exchange={yours}
            author={you}
            responder={partner}
          />
          <ExchangeList
            level={3}
            heading={round.respond.given(partnerName)}
            exchange={theirs}
            author={partner}
            responder={you}
          />
        </section>
      ))}
    </main>
  );
}
