"use client";

import { Fragment, useActionState, type ReactNode } from "react";
import { FEELINGS, MAX_FEELINGS_PER_ITEM } from "@/lib/conversation/feelings";
import {
  MAX_ITEM_LENGTH,
  RESPONSE_FIELDS,
  sittingParts,
  type Items,
  type ResponseField,
} from "@/lib/conversation/model";
import { ITEMS_PER_ROUND, type ResponseKind } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";
import { submitSitting, type SitState } from "./actions";
import { FIELD, type SittingInput } from "./sitting-input";

/** The partner's writing this sitting responds to, once revealed. */
export type Revealed = { items: Items; stance?: string };

/** What this person writes in a sitting, sent all at once. */
export function SittingForm({
  benvolioId,
  sitting,
  partnerName,
  question,
  revealed,
}: {
  benvolioId: string;
  sitting: number;
  partnerName: string;
  /** The question as this page shows it. */
  question: string;
  /** What this sitting responds to: required in every sitting but the opening. */
  revealed?: Revealed;
}) {
  const [state, action, pending] = useActionState<SitState, FormData>(submitSitting, {});
  const { stance, write, respond } = sittingParts(sitting);
  // React clears the form after every submit, so errors carry the typed values back.
  const typed = state.input;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <input type="hidden" name="sitting" value={sitting} />
      <input type="hidden" name={FIELD.question} value={state.question ?? question} />

      {respond && (
        <fieldset className={styles.form}>
          <legend className={styles.label}>{respond.prompt}</legend>
          {respond.help && <p className={styles.hint}>{respond.help}</p>}
          {revealed?.stance && (
            <p>
              {partnerName}&apos;s view: {revealed.stance}
            </p>
          )}
          {revealed!.items.map((item, i) => (
            <Respond
              key={i}
              kind={respond.kind}
              label={`${partnerName}'s ${respond.itemName} ${i + 1}`}
              item={item}
              index={i}
              typed={typed?.respond}
            />
          ))}
        </fieldset>
      )}

      {stance && (
        <>
          <label htmlFor="stance" className={styles.label}>
            Where do you stand?
          </label>
          <textarea
            id="stance"
            name={FIELD.stance}
            rows={3}
            maxLength={MAX_ITEM_LENGTH}
            required
            defaultValue={typed?.stance}
            className={styles.input}
          />
          <p className={styles.hint}>Say it in a sentence or two.</p>
        </>
      )}

      {write && (
        <fieldset className={styles.form}>
          <legend className={styles.label}>{write.prompt}</legend>
          <p className={styles.hint}>{write.help}</p>
          {Array.from({ length: ITEMS_PER_ROUND }, (_, i) => (
            <textarea
              key={i}
              name={FIELD.write}
              rows={3}
              maxLength={MAX_ITEM_LENGTH}
              required
              aria-label={`${write.itemLabel} ${i + 1}`}
              placeholder={`${write.itemLabel} ${i + 1}`}
              defaultValue={typed?.write?.[i]}
              className={styles.input}
            />
          ))}
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        Send
      </button>
      <p className={styles.hint}>
        {partnerName} won&apos;t see this until they&apos;ve written theirs.
      </p>
    </form>
  );
}

/** The response to one of the partner's items: a control for each of its kind's fields. */
function Respond({
  kind,
  label,
  item,
  index,
  typed,
}: {
  kind: ResponseKind;
  label: string;
  item: string;
  index: number;
  typed?: SittingInput["respond"];
}) {
  const id = `item-${index}`;
  const typedValue = (field: ResponseField) => typed?.[field]?.[index];
  const controls: Record<ResponseField, () => ReactNode> = {
    texts: () => (
      <textarea
        name={FIELD.respond("texts", index)}
        rows={3}
        maxLength={MAX_ITEM_LENGTH}
        required
        aria-label={kind === "rephrase" ? `${label} in your words` : `Your answer to ${label}`}
        placeholder={kind === "rephrase" ? "In your words" : "Your answer"}
        aria-describedby={id}
        defaultValue={typedValue("texts") as string | undefined}
        className={styles.input}
      />
    ),
    tags: () => (
      <Feelings
        name={FIELD.respond("tags", index)}
        about={label}
        checked={typedValue("tags") as string[] | undefined}
      />
    ),
    agree: () => (
      <fieldset className={styles.choices}>
        <legend className={styles.hint}>Do you agree with {label}?</legend>
        {[
          ["agree", "Agree"],
          ["disagree", "Disagree"],
        ].map(([value, text]) => (
          <label key={value}>
            <input
              type="radio"
              name={FIELD.respond("agree", index)}
              value={value}
              required
              defaultChecked={typedValue("agree") === (value === "agree")}
            />{" "}
            {text}
          </label>
        ))}
      </fieldset>
    ),
    ranks: () => (
      <select
        name={FIELD.respond("ranks", index)}
        required
        aria-label={`Your rank for ${label}`}
        defaultValue={String(typedValue("ranks") ?? "")}
        className={styles.input}
      >
        <option value="" disabled>
          Rank it
        </option>
        {Array.from({ length: ITEMS_PER_ROUND }, (_, r) => (
          <option key={r} value={r + 1}>
            {r + 1}
          </option>
        ))}
      </select>
    ),
  };
  return (
    <div className={styles.form}>
      <p id={id} className={styles.quote}>
        {item}
      </p>
      {RESPONSE_FIELDS[kind].map((field) => (
        <Fragment key={field}>{controls[field]()}</Fragment>
      ))}
    </div>
  );
}

/** Optional feeling tags for one item. */
function Feelings({ name, about, checked }: { name: string; about: string; checked?: string[] }) {
  return (
    <fieldset className={styles.feelings}>
      <legend className={styles.hint}>
        How did {about} make you feel? Pick up to {MAX_FEELINGS_PER_ITEM}, if any.
      </legend>
      {FEELINGS.map(({ slug, label }) => (
        <label key={slug} className={styles.feeling}>
          <input type="checkbox" name={name} value={slug} defaultChecked={checked?.includes(slug)} />{" "}
          {label}
        </label>
      ))}
    </fieldset>
  );
}
