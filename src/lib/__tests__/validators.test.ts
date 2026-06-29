import { describe, expect, it } from "vitest";
import { validateCPF } from "../validators";

describe("validateCPF", () => {
  it("rejects CPF with all identical digits", () => {
    expect(validateCPF("111.111.111-11")).toBe(false);
    expect(validateCPF("00000000000")).toBe(false);
  });

  it("accepts a valid CPF with correct check digits", () => {
    expect(validateCPF("390.533.447-05")).toBe(true);
    expect(validateCPF("39053344705")).toBe(true);
  });

  it("rejects CPF with invalid check digits", () => {
    expect(validateCPF("390.533.447-06")).toBe(false);
  });
});
