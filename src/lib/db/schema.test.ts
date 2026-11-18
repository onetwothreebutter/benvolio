// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  join as joinConversation,
  LAST_SITTING,
  MAX_QUESTION_LENGTH,
  startConversation,
  submit as submitTurn,
  visibleSubmissions as modelVisible,
  type Conversation,
  type Role,
} from "@/lib/conversation/model";

const root = join(__dirname, "../../../supabase");
const migrations = readdirSync(join(root, "migrations"))
  .sort()
  .map((file) => readFileSync(join(root, "migrations", file), "utf8"));

const JANE = "00000000-0000-4000-8000-00000000000a";
const RHONDA = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";
const B = "00000000-0000-4000-8000-0000000000b1";

let db: PGlite;

/** Runs a query as the server does, with the service role. */
async function asService(sql: string, params: unknown[] = []) {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

/** Runs a query as a signed-in person, the way the browser would. */
async function as(person: string | null, sql: string) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(person ? { sub: person } : {}),
  ]);
  await db.exec(person ? "set role authenticated" : "set role anon");
  try {
    return await db.query<Record<string, unknown>>(sql);
  } finally {
    await db.exec("reset role");
  }
}

async function submit(sitting: number, role: Role) {
  await asService(
    "insert into public.submissions (benvolio_id, sitting, role, body) values ($1, $2, $3, $4)",
    [B, sitting, role, JSON.stringify({ stance: `${role} stance ${sitting}` })],
  );
}

async function submitBoth(sitting: number) {
  await submit(sitting, "initiator");
  await submit(sitting, "recipient");
}

const visibleSubmissions = async (person: string) =>
  (await as(person, "select sitting, role from public.submissions order by sitting, role")).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, "test/supabase-stubs.sql"), "utf8"));
  for (const sql of migrations) await db.exec(sql);
});

afterAll(() => db.close());

beforeEach(async () => {
  await db.exec("truncate public.benvolios, public.people, auth.users cascade");
  await db.query(
    `insert into auth.users (id, email) values ($1, 'jane@example.com'), ($2, 'rhonda@example.com'), ($3, 'x@example.com')`,
    [JANE, RHONDA, STRANGER],
  );
  await asService(
    `insert into public.people (id, first_name) values ($1, 'Jane'), ($2, 'Rhonda'), ($3, 'Stranger')`,
    [JANE, RHONDA, STRANGER],
  );
  await asService(`insert into public.benvolios (id, question) values ($1, 'Should we get a dog?')`, [B]);
  await asService(
    `insert into public.participants (benvolio_id, role, person_id, first_name)
     values ($1, 'initiator', $2, 'Jane'), ($1, 'recipient', $3, 'Rhonda')`,
    [B, JANE, RHONDA],
  );
});

describe("reading submissions", () => {
  it("shows your own writing straight away and your partner's only once both have submitted", async () => {
    await submit(0, "initiator");
    expect(await visibleSubmissions(JANE)).toEqual([{ sitting: 0, role: "initiator" }]);
    expect(await visibleSubmissions(RHONDA)).toEqual([]);

    await submit(0, "recipient");
    const both = [
      { sitting: 0, role: "initiator" },
      { sitting: 0, role: "recipient" },
    ];
    expect(await visibleSubmissions(JANE)).toEqual(both);
    expect(await visibleSubmissions(RHONDA)).toEqual(both);
  });

  it("keeps a later sitting hidden until both have written it", async () => {
    await submitBoth(0);
    await submit(1, "initiator");
    expect(await visibleSubmissions(RHONDA)).toHaveLength(2);
    expect(await visibleSubmissions(JANE)).toHaveLength(3);
  });

  it("shows nothing to someone outside the Benvolio or signed out", async () => {
    await submitBoth(0);
    expect(await visibleSubmissions(STRANGER)).toEqual([]);
    await expect(as(null, "select * from public.submissions")).rejects.toThrow(/permission denied/);
  });
});

describe("reading everything else", () => {
  it("lets participants read their Benvolio and each other, and no one else", async () => {
    expect((await as(JANE, "select question from public.benvolios")).rows).toEqual([
      { question: "Should we get a dog?" },
    ]);
    expect((await as(STRANGER, "select * from public.benvolios")).rows).toEqual([]);
    expect((await as(RHONDA, "select first_name from public.participants order by first_name")).rows).toEqual([
      { first_name: "Jane" },
      { first_name: "Rhonda" },
    ]);
    expect((await as(RHONDA, "select first_name from public.people")).rows).toEqual([
      { first_name: "Rhonda" },
    ]);
    expect((await as(STRANGER, "select first_name from public.participants")).rows).toEqual([]);
  });

  it("never exposes invites or the email log to the browser", async () => {
    await expect(as(JANE, "select * from public.invites")).rejects.toThrow(/permission denied/);
    await expect(as(JANE, "select * from public.notifications")).rejects.toThrow(/permission denied/);
  });
});

describe("writing", () => {
  it.each([
    ["submit writing", `insert into public.submissions (benvolio_id, sitting, role, body) values ('${B}', 0, 'initiator', '{}')`],
    ["change the question", `update public.benvolios set question = 'x'`],
    ["take over a role", `update public.participants set person_id = '${STRANGER}'`],
    ["delete a partner's writing", "delete from public.submissions"],
  ])("does not let a signed-in person %s directly", async (_label, sql) => {
    await expect(as(JANE, sql)).rejects.toThrow(/permission denied/);
  });
});

describe("constraints", () => {
  it("allows one submission per person per sitting, for the model's sittings only", async () => {
    await submit(0, "initiator");
    await expect(submit(0, "initiator")).rejects.toThrow(/duplicate key/);
    await submit(LAST_SITTING, "initiator");
    await expect(submit(LAST_SITTING + 1, "initiator")).rejects.toThrow(/check constraint/);
  });

  it("allows questions up to the model's length limit", async () => {
    const update = (n: number) =>
      asService("update public.benvolios set question = $1 where id = $2", ["q".repeat(n), B]);
    await update(MAX_QUESTION_LENGTH);
    await expect(update(MAX_QUESTION_LENGTH + 1)).rejects.toThrow(/check constraint/);
  });

  it("deletes everything about a Benvolio with it", async () => {
    await submit(0, "initiator");
    await asService("delete from public.benvolios where id = $1", [B]);
    const left = await asService(
      "select (select count(*) from public.submissions) + (select count(*) from public.participants) as n",
    );
    expect(Number((left.rows[0] as { n: number }).n)).toBe(0);
  });
});

describe("agreement with the turn-taking model", () => {
  const sittingBody: Record<number, object> = {
    0: { stance: "s", write: ["a", "b", "c"] },
    1: { respond: { kind: "rephrase", texts: ["a", "b", "c"] }, write: ["a", "b", "c"] },
    2: { respond: { kind: "answer", texts: ["a", "b", "c"], tags: [[], [], []] }, write: ["a", "b", "c"] },
  };
  const person = { initiator: JANE, recipient: RHONDA };

  /** What the model says each person may see, as (sitting, role) pairs. */
  function modelView(c: Conversation, viewer: Role) {
    const rows: { sitting: number; role: Role }[] = [];
    for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
      const { mine, partner } = modelVisible(c, sitting, viewer);
      const other: Role = viewer === "initiator" ? "recipient" : "initiator";
      const seen = [mine && viewer, partner && other].filter(Boolean) as Role[];
      for (const role of seen.sort()) rows.push({ sitting, role });
    }
    return rows;
  }

  it("shows each person exactly what the model allows at every step", async () => {
    let c = joinConversation(startConversation("Should we get a dog?"));
    const steps: [number, Role][] = [
      [0, "initiator"], [0, "recipient"], [1, "recipient"], [1, "initiator"], [2, "initiator"], [2, "recipient"],
    ];
    for (const [sitting, role] of steps) {
      c = submitTurn(c, role, sitting, sittingBody[sitting]);
      await asService(
        "insert into public.submissions (benvolio_id, sitting, role, body) values ($1, $2, $3, $4)",
        [B, sitting, role, JSON.stringify(sittingBody[sitting])],
      );
      for (const viewer of ["initiator", "recipient"] as const) {
        expect(await visibleSubmissions(person[viewer])).toEqual(modelView(c, viewer));
      }
    }
  });
});
