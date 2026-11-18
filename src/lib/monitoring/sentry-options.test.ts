// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import * as SentryNode from "@sentry/node";
import { createTransport } from "@sentry/core";
import type { ErrorEvent } from "@sentry/nextjs";
import { afterAll, describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

const TOKEN = ["Xy7k2Lm9", "QwErTy0UiOp1"].join("");
// Built at runtime so this file's own source lines (which Sentry attaches to
// stack frames) don't contain it.
const EMAIL = ["jane", "example.com"].join("@");

describe("sentryOptions", () => {
  it("turns off collection of personal data and trace headers", () => {
    expect(sentryOptions.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(sentryOptions.tracePropagationTargets).toEqual([]);
  });

  it("scrubs free text in an event but keeps Sentry's own ids", () => {
    const event = sentryOptions.beforeSend({
      type: undefined,
      event_id: "0123456789abcdef0123456789abcdef",
      release: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
      contexts: { trace: { trace_id: "0123456789abcdef0123456789abcdef", span_id: "0123456789abcdef" } },
      message: `Invite ${TOKEN} for jane@example.com not found`,
      transaction: `POST /join/${TOKEN}`,
      // Not in the ErrorEvent type, but some SDK paths set it.
      ...{ culprit: `/b/${TOKEN}` },
      user: { username: "jane@example.com" },
      some_future_field: `https://benvolio.app/join/${TOKEN}`,
      request: { url: `https://benvolio.app/join/${TOKEN}?x=1` },
      extra: { note: `see /b/${TOKEN}` },
      exception: {
        values: [
          {
            value: `Failed to fetch RSC payload for https://benvolio.app/join/${TOKEN}?_rsc=1`,
            stacktrace: {
              frames: [
                { filename: "app:///_next/static/chunks/a1b2c3d4e5f6a7b8.js?v=2", lineno: 1 },
                { filename: `https://benvolio.app/join/${TOKEN}?e=jane@example.com` },
              ],
            },
          },
        ],
      },
    } as ErrorEvent);
    expect(event.event_id).toBe("0123456789abcdef0123456789abcdef");
    expect(event.release).toBe("a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0");
    expect(event.contexts?.trace?.trace_id).toBe("0123456789abcdef0123456789abcdef");
    expect(event.message).toBe("Invite :id for [email] not found");
    expect(event.transaction).toBe("POST /join/:id");
    expect((event as unknown as { culprit: string }).culprit).toBe("/b/:id");
    expect(event.user).toEqual({ username: "[email]" });
    expect((event as unknown as Record<string, string>).some_future_field).toBe("https://benvolio.app/join/:id");
    expect(event.request?.url).toBe("https://benvolio.app/join/:id");
    expect(event.extra).toEqual({ note: "see /b/:id" });
    const [value] = event.exception?.values ?? [];
    expect(value.value).toBe("Failed to fetch RSC payload for https://benvolio.app/join/:id");
    expect(value.stacktrace?.frames).toEqual([
      { filename: "app:///_next/static/chunks/a1b2c3d4e5f6a7b8.js", lineno: 1 },
      { filename: "https://benvolio.app/join/:id" },
    ]);
  });

  it("drops console breadcrumbs and scrubs the rest", () => {
    expect(sentryOptions.beforeBreadcrumb({ category: "console", message: "anything" })).toBeNull();
    const crumb = sentryOptions.beforeBreadcrumb({
      category: "navigation",
      data: { from: "/", to: `/join/${TOKEN}` },
    });
    expect(crumb?.data).toEqual({ from: "/", to: "/join/:id" });
  });
});

describe("sentryOptions with the real SDK", () => {
  const sent: string[] = [];
  afterAll(() => SentryNode.close());

  SentryNode.init({
    ...sentryOptions,
    dsn: "https://public@o0.ingest.sentry.io/0",
    release: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
    transport: (options) =>
      createTransport(options, async (request) => {
        sent.push(
          typeof request.body === "string" ? request.body : new TextDecoder().decode(request.body),
        );
        return { statusCode: 200 };
      }),
  });

  function lastEvent() {
    const [header, , item] = sent[sent.length - 1].split("\n").map((line) => JSON.parse(line));
    return { header, item, raw: sent[sent.length - 1] };
  }

  it("sends a scrubbed event with a valid event id", async () => {
    SentryNode.captureException(new Error(`Invite ${TOKEN} for ${EMAIL} not found`));
    await SentryNode.flush(2000);
    const { header, item, raw } = lastEvent();
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item.event_id).toBe(header.event_id);
    expect(item.release).toBe("a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0");
    expect(item.exception.values[0].value).toBe("Invite :id for [email] not found");
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain(EMAIL);
  });

  it("scrubs what Sentry fills in from a request, such as the transaction name", async () => {
    const server = createServer((_req, res) => {
      SentryNode.captureException(new Error("boom"));
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await fetch(`http://127.0.0.1:${port}/join/${TOKEN}?e=${EMAIL}`);
    await SentryNode.flush(2000);
    server.close();

    const { item, raw } = lastEvent();
    expect(item.exception.values[0].value).toBe("boom");
    if (item.transaction !== undefined) expect(item.transaction).toBe("GET /join/:id");
    expect(item.user ?? {}).toEqual({});
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain(EMAIL);
  });
});
