import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, requireSignedIn } from "@/lib/auth/session";
import { safeNext, withNext } from "@/lib/auth/safe-next";
import { Masthead } from "../masthead";
import styles from "../form.module.css";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const { userId } = await requireSignedIn(withNext("/welcome", next));
  if (await getProfile(userId)) redirect(next);
  return (
    <main className={styles.main}>
      <Masthead />
      <h1>Welcome to Benvolio</h1>
      <WelcomeForm next={next} />
    </main>
  );
}
