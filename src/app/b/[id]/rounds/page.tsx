import type { Metadata } from "next";
import Link from "next/link";
import { sharedRounds, stances } from "@/lib/conversation/model";
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
  const standing = stances(conversation, role);
  const rounds = sharedRounds(conversation, role);

  return (
    <main className={styles.main}>
      <p className={styles.hint}>With {partnerName}</p>
      <h1>{conversation.question.text}</h1>
      <p>
        <Link href={home} className={styles.link}>
          Back to your Benvolio
        </Link>
      </p>
      {standing && (
        <section aria-labelledby="stances" className={styles.apart}>
          <h2 id="stances">Where you each stand</h2>
          <Words who={you} text={standing.yours} />
          <Words who={partner} text={standing.theirs} />
        </section>
      )}
      {rounds.length === 0 && <p>Each round appears here once you&apos;ve both responded to it.</p>}
      {rounds.map(({ round, yours, theirs }) => {
        const { title, respond } = ROUNDS[round - 1];
        return (
          <section key={round} aria-labelledby={`round-${round}`} className={styles.apart}>
            <h2 id={`round-${round}`}>
              Round {round} of {ROUNDS.length}: {title}
            </h2>
            <ExchangeList
              level={3}
              heading={respond.seen(partnerName)}
              exchange={yours}
              author={you}
              responder={partner}
            />
            <ExchangeList
              level={3}
              heading={respond.given(partnerName)}
              exchange={theirs}
              author={partner}
              responder={you}
            />
          </section>
        );
      })}
    </main>
  );
}
