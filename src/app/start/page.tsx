import type { Metadata } from "next";
import { requirePerson } from "@/lib/auth/session";
import { Masthead } from "../masthead";
import styles from "../form.module.css";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Start a Benvolio" };

export default async function StartPage() {
  await requirePerson("/start");
  return (
    <main className={styles.main}>
      <Masthead />
      <h1>Start a Benvolio</h1>
      <StartForm />
    </main>
  );
}
