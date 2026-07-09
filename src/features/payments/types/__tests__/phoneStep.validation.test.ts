import { describe, expect, it } from "vitest";
import { phoneStepSchema } from "../phoneStep.validation";

describe("phoneStepSchema", () => {
  it("accepts a valid Brazilian phone", () => {
    expect(phoneStepSchema.safeParse({ phone: "(48) 99999-9999" }).success).toBe(true);
  });

  it("rejects empty or invalid phone", () => {
    expect(phoneStepSchema.safeParse({ phone: "" }).success).toBe(false);
    expect(phoneStepSchema.safeParse({ phone: "123" }).success).toBe(false);
  });
});
