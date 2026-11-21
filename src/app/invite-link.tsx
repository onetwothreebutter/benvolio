"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import styles from "./form.module.css";

const noChanges = () => () => {};

/**
 * Whether this browser has a share sheet. False on the server and while the
 * page hydrates, then the browser's answer, so the label never disagrees with
 * what the button does.
 */
function useCanShare() {
  return useSyncExternalStore(
    noChanges,
    () => "share" in navigator,
    () => false,
  );
}

/** An invite link to send, with the phone's share sheet where there is one. */
export function InviteLink({ url, partnerName }: { url: string; partnerName: string }) {
  const canShare = useCanShare();
  const [copy, setCopy] = useState<"copied" | "failed" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function share() {
    if (canShare) {
      await navigator.share({ title: "Benvolio", url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      // No clipboard access (an old browser, or permission refused): select
      // the link so copying it by hand is one step.
      setCopy("failed");
      input.current?.focus();
      input.current?.select();
    }
  }

  return (
    <>
      <p className={styles.hint}>
        Send {partnerName} this link. It works once and expires in 30 days. They won&apos;t see your
        answers until they&apos;ve written their own.
      </p>
      <input ref={input} readOnly value={url} aria-label="Invite link" className={styles.copyField} />
      <button type="button" onClick={share} className={styles.button}>
        {canShare ? "Share the link" : copy === "copied" ? "Copied" : "Copy the link"}
      </button>
      {copy === "failed" && (
        <p role="alert" className={styles.error}>
          We couldn&apos;t copy it. The link is selected above, so copy it from there.
        </p>
      )}
    </>
  );
}
