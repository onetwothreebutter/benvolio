import { describe, expect, it } from "vitest";
import { parseSubmission } from "./model";
import { sittingInput } from "./sitting-input";

function form(fields: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
}

describe("sittingInput", () => {
  it("reads the opening's stance and three items, in order", () => {
    const input = sittingInput(
      0,
      form([
        ["stance", " Yes "],
        ["write", "a"],
        ["write", "b"],
        ["write", "c"],
      ]),
    );
    expect(input).toEqual({ stance: " Yes ", write: ["a", "b", "c"] });
    expect(parseSubmission(0, input)).toEqual({
      ok: true,
      submission: { stance: "Yes", write: ["a", "b", "c"] },
    });
  });

  it("leaves out what the sitting doesn't have, so the model can say what's missing", () => {
    expect(sittingInput(1, form([["stance", "Yes"]]))).toEqual({ write: [] });
    expect(parseSubmission(0, sittingInput(0, form([])))).toEqual({ ok: false, invalid: "stance" });
  });
});
