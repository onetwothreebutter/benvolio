import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The signed-in person's Benvolios, newest first. Row-level security limits it to theirs. */
export async function myBenvolios(): Promise<{ id: string; question: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("benvolios")
    .select("id, question")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Listing Benvolios failed: ${error.message}`);
  return data;
}
