import { describe, expect, it } from "vitest";
import { safeNext, withNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/join/abc?x=1")).toBe("/join/abc?x=1");
  });

  it.each([
    ["missing", undefined],
    ["not a string", 5],
    ["another site", "https://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["relative", "evil"],
    ["tab", "/\t/evil.example"],
    ["newline", "/x\n"],
    ["too long", "/" + "a".repeat(600)],
  ])("falls back for %s", (_name, value) => {
    expect(safeNext(value)).toBe("/");
  });
});

describe("withNext", () => {
  it("encodes the return path", () => {
    expect(withNext("/sign-in", "/join/a?b=c")).toBe("/sign-in?next=%2Fjoin%2Fa%3Fb%3Dc");
  });
});
