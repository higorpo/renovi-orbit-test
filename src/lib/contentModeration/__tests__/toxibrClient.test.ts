import { describe, expect, it } from "vitest";
import { filterWithToxibr } from "../toxibrClient";

describe("toxibrClient", () => {
  it("blocks hard profanity via ToxiBR", () => {
    const result = filterWithToxibr("porra");
    expect(result.allowed).toBe(false);
  });

  it("allows short numeric chat fragments when digits-only blocking is disabled", () => {
    expect(filterWithToxibr("9").allowed).toBe(true);
    expect(filterWithToxibr("996").allowed).toBe(true);
  });
});
