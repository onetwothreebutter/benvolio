// @vitest-environment node
import * as SentryNode from "@sentry/node";
import { createTransport } from "@sentry/core";
import type { ErrorEvent } from "@sentry/nextjs";
import { afterAll, describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

const TOKEN = "Xy7k2Lm9QwErTy0UiOp1";

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

  it("sends a scrubbed event with a valid event id", async () => {
    SentryNode.init({
      ...sentryOptions,
      dsn: "https://public@o0.ingest.sentry.io/0",
      release: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
      defaultIntegrations: false,
      transport: (options) =>
        createTransport(options, async (request) => {
          sent.push(
            typeof request.body === "string" ? request.body : new TextDecoder().decode(request.body),
          );
          return { statusCode: 200 };
        }),
    });
    SentryNode.captureException(new Error(`Invite ${TOKEN} for jane@example.com not found`));
    await SentryNode.flush(2000);

    expect(sent).toHaveLength(1);
    const [header, , item] = sent[0].split("\n").map((line) => JSON.parse(line));
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item.event_id).toBe(header.event_id);
    expect(item.release).toBe("a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0");
    expect(item.exception.values[0].value).toBe("Invite :id for [email] not found");
    expect(sent[0]).not.toContain(TOKEN);
    expect(sent[0]).not.toContain("jane@example.com");
  });
});
