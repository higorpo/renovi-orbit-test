import { describe, expect, it } from "vitest";
import { cpfStepSchema } from "../cpfStep.validation";

describe("cpfStepSchema", () => {
  it("accepts a valid CPF", () => {
    expect(cpfStepSchema.safeParse({ cpf: "390.533.447-05" }).success).toBe(true);
  });

  it("rejects empty or invalid CPF", () => {
    expect(cpfStepSchema.safeParse({ cpf: "" }).success).toBe(false);
    expect(cpfStepSchema.safeParse({ cpf: "111.111.111-11" }).success).toBe(false);
  });
});
