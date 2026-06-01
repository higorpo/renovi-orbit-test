import { describe, expect, it } from "vitest";
import { getCounterpartyInitials } from "../getCounterpartyInitials";

describe("getCounterpartyInitials", () => {
  it("returns question mark for empty names", () => {
    expect(getCounterpartyInitials(null)).toBe("?");
    expect(getCounterpartyInitials("   ")).toBe("?");
  });

  it("returns two letters for a single name", () => {
    expect(getCounterpartyInitials("Ana")).toBe("AN");
  });

  it("returns first and last initials for multi-part names", () => {
    expect(getCounterpartyInitials("João Silva")).toBe("JS");
  });
});
