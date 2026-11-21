// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_FIRST_NAME_LENGTH } from "@/lib/people/first-name";
import {
  decideQuestion,
  join as joinConversation,
  LAST_SITTING,
  MAX_QUESTION_LENGTH,
  startConversation,
  submit as submitTurn,
  visibleSubmissions as modelVisible,
  type Conversation,
  type Role,
} from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";

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

  it("holds the opening while new wording is pending, even if both have written it", async () => {
    await submitBoth(0);
    await asService("update public.benvolios set proposed_question = 'Should we get a dog this year?' where id = $1", [B]);
    expect(await visibleSubmissions(JANE)).toEqual([{ sitting: 0, role: "initiator" }]);
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

  it("does not let anyone call the policy helpers directly", async () => {
    const { rows } = await db.query(
      `select has_function_privilege('anon', 'private.my_benvolio_ids()', 'execute') as ids,
              has_function_privilege('anon', 'private.can_read_submission(uuid, smallint, public.participant_role)', 'execute') as can_read,
              has_schema_privilege('anon', 'private', 'usage') as schema_usage`,
    );
    expect(rows).toEqual([{ ids: false, can_read: false, schema_usage: false }]);
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

  it("allows first names up to the app's length limit", async () => {
    const update = (n: number) =>
      asService("update public.people set first_name = $1 where id = $2", ["n".repeat(n), JANE]);
    await update(MAX_FIRST_NAME_LENGTH);
    await expect(update(MAX_FIRST_NAME_LENGTH + 1)).rejects.toThrow(/check constraint/);
  });

  it("requires the initiator to have an account", async () => {
    await expect(
      asService("update public.participants set person_id = null where role = 'initiator'"),
    ).rejects.toThrow(/check constraint/);
  });

  it("deletes a person's Benvolios, for both people, when their account is deleted", async () => {
    await submitBoth(0);
    await asService("delete from public.people where id = $1", [RHONDA]);
    expect((await asService("select count(*)::int as n from public.benvolios")).rows).toEqual([{ n: 0 }]);
    expect(await visibleSubmissions(JANE)).toEqual([]);
  });

  it("records each reminder once, however many runs try to send it", async () => {
    const send = (n: number | null, kind = "reminder") =>
      asService(
        `insert into public.notifications (benvolio_id, role, kind, sitting, reminder_number)
         values ($1, 'recipient', $2, 1, $3) on conflict do nothing returning id`,
        [B, kind, n],
      );
    expect((await send(1)).rows).toHaveLength(1);
    expect((await send(1)).rows).toHaveLength(0);
    expect((await send(2)).rows).toHaveLength(1);
    expect((await send(null, "your_turn")).rows).toHaveLength(1);
    expect((await send(null, "your_turn")).rows).toHaveLength(0);
    await expect(send(null)).rejects.toThrow(/check constraint/);
    await expect(send(1, "your_turn")).rejects.toThrow(/check constraint/);
    // An invite can be re-sent after it expires.
    expect((await send(null, "invite")).rows).toHaveLength(1);
    expect((await send(1, "invite")).rows).toHaveLength(1);
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
  const person = { initiator: JANE, recipient: RHONDA };

  /** What the model says each person may see, as (sitting, role) pairs. */
  function modelView(c: Conversation, viewer: Role) {
    const other: Role = viewer === "initiator" ? "recipient" : "initiator";
    const rows: { sitting: number; role: Role }[] = [];
    for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
      const { mine, partner } = modelVisible(c, sitting, viewer);
      const seen = [mine && viewer, partner && other].filter(Boolean) as Role[];
      for (const role of seen.sort()) rows.push({ sitting, role });
    }
    return rows;
  }

  async function expectSameView(c: Conversation) {
    for (const viewer of ["initiator", "recipient"] as const) {
      expect(await visibleSubmissions(person[viewer])).toEqual(modelView(c, viewer));
    }
  }

  async function sit(c: Conversation, sitting: number, role: Role) {
    const next = submitTurn(c, role, sitting, validSitting(sitting, role));
    await asService(
      "insert into public.submissions (benvolio_id, sitting, role, body) values ($1, $2, $3, $4)",
      [B, sitting, role, JSON.stringify(validSitting(sitting, role))],
    );
    await expectSameView(next);
    return next;
  }

  it("shows each person exactly what the model allows through a whole conversation", async () => {
    let c = joinConversation(startConversation("Should we get a dog?"));
    for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
      const [first, second]: Role[] =
        sitting % 2 ? ["recipient", "initiator"] : ["initiator", "recipient"];
      c = await sit(c, sitting, first);
      c = await sit(c, sitting, second);
    }
  });

  it("agrees while new wording is pending and after it is accepted", async () => {
    const NEW = "Should we get a dog this year?";
    let c = await sit(startConversation("Should we get a dog?"), 0, "initiator");
    c = joinConversation(c, NEW);
    await asService("update public.benvolios set proposed_question = $1 where id = $2", [NEW, B]);
    await expectSameView(c);

    c = decideQuestion(c, "initiator", true);
    await asService("select public.decide_question($1, $2, true)", [B, JANE]);
    await expectSameView(c);
    expect((await as(JANE, "select question from public.benvolios")).rows).toEqual([{ question: NEW }]);

    c = await sit(c, 0, "recipient");
    c = await sit(c, 0, "initiator");
  });
});

describe("starting and joining", () => {
  const start = (initiator = JANE, hash = "hash-1") =>
    asService(
      "select public.start_benvolio($1, 'Cats or dogs?', 'Rhonda', 'rhonda@example.com', $2) as id",
      [initiator, hash],
    ).then((r) => (r.rows[0] as { id: string }).id);
  const joinAs = (person: string, hash = "hash-1", proposed: string | null = null) =>
    asService("select public.join_benvolio($1, $2, $3) as id", [hash, person, proposed]).then(
      (r) => (r.rows[0] as { id: string }).id,
    );

  it("starts a Benvolio with an invite, and joining uses the invite up", async () => {
    const id = await start();
    expect(
      (
        await as(
          JANE,
          `select role, first_name, person_id from public.participants where benvolio_id = '${id}' order by role`,
        )
      ).rows,
    ).toEqual([
      { role: "initiator", first_name: "Jane", person_id: JANE },
      { role: "recipient", first_name: "Rhonda", person_id: null },
    ]);
    // Rhonda signs up as "Ronnie": her own name replaces the one Jane typed.
    await asService("update public.people set first_name = 'Ronnie' where id = $1", [RHONDA]);
    await asService("update public.benvolios set active_at = '2026-01-01' where id = $1", [id]);
    expect(await joinAs(RHONDA)).toBe(id);
    // Joining counts as a move, for reminders.
    expect(
      (await asService("select active_at > now() - interval '1 hour' as moved from public.benvolios where id = $1", [id]))
        .rows,
    ).toEqual([{ moved: true }]);
    expect(
      (
        await as(
          RHONDA,
          `select first_name from public.participants where benvolio_id = '${id}' and role = 'recipient'`,
        )
      ).rows,
    ).toEqual([{ first_name: "Ronnie" }]);
    expect((await asService("select count(*)::int as n from public.invites")).rows).toEqual([
      { n: 0 },
    ]);
    await expect(joinAs(STRANGER)).rejects.toThrow("invite_not_found");
  });

  it("keeps new wording pending for the initiator", async () => {
    const id = await start();
    await joinAs(RHONDA, "hash-1", "Cats, dogs or neither?");
    expect(
      (
        await as(
          JANE,
          `select question, proposed_question from public.benvolios where id = '${id}'`,
        )
      ).rows,
    ).toEqual([{ question: "Cats or dogs?", proposed_question: "Cats, dogs or neither?" }]);
  });

  it("refuses an expired invite, your own invite, and anyone without a profile", async () => {
    await start(JANE, "old");
    await asService(
      "update public.invites set expires_at = now() - interval '1 minute' where token_hash = 'old'",
    );
    await expect(joinAs(RHONDA, "old")).rejects.toThrow("invite_not_found");

    await start();
    await expect(joinAs(JANE)).rejects.toMatchObject({ code: "BVOWN" });
    await db.query(
      `insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000d', 'new@example.com')`,
    );
    await expect(joinAs("00000000-0000-4000-8000-00000000000d")).rejects.toThrow("no_profile");
    await expect(start("00000000-0000-4000-8000-00000000000d", "hash-2")).rejects.toThrow(
      "no_profile",
    );
    expect(
      (
        await asService(
          "select count(*)::int as n from public.benvolios where question = 'Cats or dogs?'",
        )
      ).rows,
    ).toEqual([{ n: 2 }]);
  });

  it("lets only the initiator renew an invite, and only before anyone joins", async () => {
    const id = await start();
    const renew = (person: string, hash: string) =>
      asService("select public.renew_invite($1, $2, $3) as ok", [id, person, hash]).then(
        (r) => (r.rows[0] as { ok: boolean }).ok,
      );
    await asService("update public.invites set expires_at = now() - interval '1 minute'");
    expect(await renew(RHONDA, "hash-x")).toBe(false);
    expect(await renew(JANE, "hash-2")).toBe(true);
    await expect(joinAs(RHONDA, "hash-1")).rejects.toThrow("invite_not_found");
    expect(await joinAs(RHONDA, "hash-2")).toBe(id);
    expect(await renew(JANE, "hash-3")).toBe(false);
  });

  it("lets only the initiator decide on new wording, once", async () => {
    const decide = (person: string, accept: boolean) =>
      asService("select public.decide_question($1, $2, $3) as ok", [B, person, accept]).then(
        (r) => (r.rows[0] as { ok: boolean }).ok,
      );
    const question = async () =>
      (await asService("select question, proposed_question from public.benvolios where id = $1", [B]))
        .rows[0];
    expect(await decide(JANE, false)).toBe(false);

    await submit(0, "initiator");
    await asService("update public.benvolios set proposed_question = 'A dog or a cat?' where id = $1", [B]);
    expect(await decide(RHONDA, true)).toBe(false);
    expect(await decide(STRANGER, true)).toBe(false);
    expect(await decide(JANE, false)).toBe(true);
    expect(await question()).toEqual({ question: "Should we get a dog?", proposed_question: null });
    // Keeping the wording keeps Jane's opening.
    expect(await visibleSubmissions(JANE)).toEqual([{ sitting: 0, role: "initiator" }]);
    expect(await decide(JANE, true)).toBe(false);
  });

  it("can only be called by the server", async () => {
    const callable = await db.query<{ fn: string; ok: boolean }>(
      `select r as fn, has_function_privilege(r, f, 'execute') as ok
       from unnest(array['anon', 'authenticated', 'service_role']) r,
            unnest(array['public.start_benvolio(uuid, text, text, text, text, public.benvolio_pace)',
                         'public.join_benvolio(text, uuid, text)',
                         'public.renew_invite(uuid, uuid, text)',
                         'public.decide_question(uuid, uuid, boolean)']) f
       order by 1`,
    );
    const allowed = (role: string) =>
      callable.rows.filter((row) => row.fn === role).map((row) => row.ok);
    expect(allowed("anon")).toEqual([false, false, false, false]);
    expect(allowed("authenticated")).toEqual([false, false, false, false]);
    expect(allowed("service_role")).toEqual([true, true, true, true]);
  });
});

describe("when a Benvolio last moved", () => {
  const LONG_AGO = "2026-01-01T00:00:00Z";
  const age = async () => {
    const { rows } = await asService("select active_at < now() - interval '1 day' as old from public.benvolios where id = $1", [B]);
    return (rows[0] as { old: boolean }).old ? "old" : "now";
  };
  beforeEach(() => asService("update public.benvolios set active_at = $2 where id = $1", [B, LONG_AGO]));

  it("starts now, and moves on each sitting sent", async () => {
    expect(await age()).toBe("old");
    await submit(0, "initiator");
    expect(await age()).toBe("now");
  });

  it("moves when the question's wording is decided, and not on other changes", async () => {
    await asService("update public.benvolios set pace = 'weekly' where id = $1", [B]);
    expect(await age()).toBe("old");
    // Nothing to decide: nothing moves.
    await asService("select public.decide_question($1, $2, false)", [B, JANE]);
    expect(await age()).toBe("old");
    await asService("update public.benvolios set proposed_question = 'Cats?', active_at = $2 where id = $1", [B, LONG_AGO]);
    await asService("update public.benvolios set active_at = $2 where id = $1", [B, LONG_AGO]);
    await asService("select public.decide_question($1, $2, false)", [B, JANE]);
    expect(await age()).toBe("now");
  });
});
