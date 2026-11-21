// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { nextAction } from "@/lib/conversation/model";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const queries = vi.hoisted(() => [] as { table: string; ids: string[]; select: string }[]);
const rows = vi.hoisted(() => ({}) as Record<string, (ids: string[]) => unknown[]>);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (select: string) => ({
        in: (_column: string, ids: string[]) => {
          queries.push({ table, ids, select });
          return Promise.resolve({ data: rows[table](ids), error: null });
        },
      }),
    }),
  }),
}));

const { loadBenvoliosForEmail } = await import("./load-benvolio");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("loadBenvoliosForEmail", () => {
  it("loads in batches, never what anyone wrote, and works out whose turn it is", async () => {
    rows.benvolios = (ids) =>
      ids.map((b) => ({ id: b, question: "Dogs?", proposed_question: null, pace: "daily", active_at: "2026-11-01T00:00:00Z" }));
    rows.participants = (ids) =>
      ids.flatMap((b) => [
        { benvolio_id: b, role: "initiator", person_id: "jane", first_name: "Jane" },
        { benvolio_id: b, role: "recipient", person_id: "rhonda", first_name: "Rhonda" },
      ]);
    rows.submissions = (ids) => ids.map((b) => ({ benvolio_id: b, sitting: 0, role: "initiator" }));
    const ids = Array.from({ length: 60 }, (_, n) => id(n));

    const loaded = await loadBenvoliosForEmail([...ids, "not-an-id"]);

    expect(loaded).toHaveLength(60);
    expect(queries.filter((q) => q.table === "submissions").map((q) => q.ids.length)).toEqual([50, 10]);
    expect(queries.find((q) => q.table === "submissions")?.select).not.toContain("body");
    const [first] = loaded;
    expect(first).toMatchObject({ id: id(0), pace: "daily", activeAt: "2026-11-01T00:00:00Z" });
    expect(first.people.map((p) => p.first_name)).toEqual(["Jane", "Rhonda"]);
    expect(nextAction(first.conversation, "initiator")).toEqual({ kind: "wait", sitting: 0 });
    expect(nextAction(first.conversation, "recipient")).toEqual({ kind: "sit", sitting: 0 });
  });
});
