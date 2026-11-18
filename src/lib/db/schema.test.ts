// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const root = join(__dirname, "../../../supabase");
const migrations = readdirSync(join(root, "migrations"))
  .sort()
  .map((file) => readFileSync(join(root, "migrations", file), "utf8"));

const JANE = "00000000-0000-4000-8000-00000000000a";
const RHONDA = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";
const B = "00000000-0000-4000-8000-0000000000b1";

let db: PGlite;

async function asService(sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  return db.query(sql, params);
}

/** Runs a query as a signed-in person, the way the browser would. */
async function as(person: string | null, sql: string) {
  await db.exec("reset role");
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

async function submit(sitting: number, role: "initiator" | "recipient") {
  await asService(
    "insert into public.submissions (benvolio_id, sitting, role, body) values ($1, $2, $3, $4)",
    [B, sitting, role, JSON.stringify({ stance: `${role} stance ${sitting}` })],
  );
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
  await asService("truncate public.benvolios, public.people, auth.users cascade");
  await asService(
    `insert into auth.users (id, email) values ($1, 'jane@example.com'), ($2, 'rhonda@example.com'), ($3, 'x@example.com')`,
    [JANE, RHONDA, STRANGER],
  );
  await asService(
    `insert into public.people (id, first_name) values ($1, 'Jane'), ($2, 'Rhonda'), ($3, 'Stranger')`,
    [JANE, RHONDA, STRANGER],
  );
  await asService(`insert into public.benvolios (id, question) values ($1, 'Should we get a dog?')`, [B]);
  await asService(
    `insert into public.participants (benvolio_id, role, person_id, first_name, joined_at)
     values ($1, 'initiator', $2, 'Jane', now()), ($1, 'recipient', $3, 'Rhonda', now())`,
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
    await submit(0, "initiator");
    await submit(0, "recipient");
    await submit(1, "initiator");
    expect(await visibleSubmissions(RHONDA)).toHaveLength(2);
    expect(await visibleSubmissions(JANE)).toHaveLength(3);
  });

  it("holds the opening while new wording for the question is pending", async () => {
    await submit(0, "initiator");
    await submit(0, "recipient");
    await asService("update public.benvolios set proposed_question = 'Should we get a dog this year?' where id = $1", [B]);
    expect(await visibleSubmissions(JANE)).toEqual([{ sitting: 0, role: "initiator" }]);
  });

  it("shows nothing to someone outside the Benvolio or signed out", async () => {
    await submit(0, "initiator");
    await submit(0, "recipient");
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
    expect((await as(RHONDA, "select first_name from public.people order by first_name")).rows).toEqual([
      { first_name: "Jane" },
      { first_name: "Rhonda" },
    ]);
    expect((await as(STRANGER, "select first_name from public.people")).rows).toEqual([
      { first_name: "Stranger" },
    ]);
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
  it("allows one submission per person per sitting, for sittings 0 to 5 only", async () => {
    await submit(0, "initiator");
    await expect(submit(0, "initiator")).rejects.toThrow(/duplicate key/);
    await expect(submit(6, "initiator")).rejects.toThrow(/check constraint/);
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
