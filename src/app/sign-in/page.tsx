import type { Metadata } from "next";
import { safeNext } from "@/lib/auth/safe-next";
import { Masthead } from "../masthead";
import styles from "../form.module.css";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className={styles.main}>
      <Masthead />
      <h1>Sign in</h1>
      {error === "link" && (
        <p role="alert" className={styles.error}>
          That sign-in link has expired or was already used. Ask for a new code below.
        </p>
      )}
      <SignInForm next={safeNext(next)} />
    </main>
  );
}
