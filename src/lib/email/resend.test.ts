// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { emailEnabled, sendEmail } = await import("./resend");

const email = {
  to: "rhonda@example.com",
  subject: "Your turn with Jane",
  html: "<p>Hi</p>",
  text: "Hi",
  tags: { kind: "your_turn" },
  idempotencyKey: "b/recipient/your_turn/1",
};

describe("sendEmail", () => {
  const fetch = vi.fn();
  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("RESEND_API_KEY", "re_test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts the email to Resend with an idempotency key", async () => {
    fetch.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmail(email);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": email.idempotencyKey });
    expect(JSON.parse(init.body)).toEqual({
      from: "Benvolio <hello@mail.benvolio.app>",
      to: ["rhonda@example.com"],
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: "kind", value: "your_turn" }],
    });
  });

  it("throws on a refusal, without Resend's message, which can quote the address", async () => {
    const body = JSON.stringify({ name: "validation_error", message: "Invalid `to`: rhonda@example.com" });
    fetch.mockResolvedValue(new Response(body, { status: 422 }));
    await expect(sendEmail(email)).rejects.toThrow(/^Resend refused an email: 422 validation_error$/);
  });

  it("is off without an API key", async () => {
    expect(emailEnabled()).toBe(true);
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailEnabled()).toBe(false);
    await expect(sendEmail(email)).rejects.toThrow("RESEND_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
});
