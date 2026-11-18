import { describe, expect, it } from "vitest";
import { refusal } from "./rpc-error";

describe("refusal", () => {
  it("names the refusals the SQL functions raise", () => {
    expect(refusal({ code: "BVINV" })).toBe("invite_not_found");
    expect(refusal({ code: "BVOWN" })).toBe("own_invite");
    expect(refusal({ code: "BVPRO" })).toBe("no_profile");
  });

  it("leaves anything else unexpected", () => {
    expect(refusal(null)).toBeNull();
    expect(refusal({ code: "23505" })).toBeNull();
    expect(refusal({ code: "toString" })).toBeNull();
  });
});
