import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("/ingest proxy", () => {
  it("forwards only the body, query, content type and user agent", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { headers: { "set-cookie": "x=1", "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://benvolio.app/ingest/e/?ver=1", {
      method: "POST",
      body: "payload",
      headers: {
        "content-type": "text/plain",
        "user-agent": "phone",
        cookie: "session=secret",
        referer: "https://benvolio.app/join/Xy7k2Lm9QwErTy0UiOp1",
        "x-forwarded-for": "1.2.3.4",
      },
    });
    const response = await POST(request, { params: Promise.resolve({ path: ["e"] }) });

    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe("https://us.i.posthog.com/e/?ver=1");
    expect(Object.fromEntries(new Headers(init.headers))).toEqual({
      "content-type": "text/plain",
      "user-agent": "phone",
    });
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe("payload");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("ok");
  });

  it("sends static assets to the assets host", async () => {
    const fetchMock = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetchMock);
    await POST(new Request("https://benvolio.app/ingest/static/web-vitals.js"), {
      params: Promise.resolve({ path: ["static", "web-vitals.js"] }),
    });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://us-assets.i.posthog.com/static/web-vitals.js",
    );
  });
});
