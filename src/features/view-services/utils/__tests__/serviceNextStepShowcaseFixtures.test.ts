import { describe, expect, it } from "vitest";
import { buildServiceNextStepShowcaseVariants } from "../serviceNextStepShowcaseFixtures";

describe("buildServiceNextStepShowcaseVariants", () => {
  it("covers client, provider, and disabled state groups without duplicate ids", () => {
    const variants = buildServiceNextStepShowcaseVariants();
    const ids = variants.map((variant) => variant.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(variants.some((variant) => variant.group === "Cliente")).toBe(true);
    expect(variants.some((variant) => variant.group === "Prestador")).toBe(true);
    expect(variants.some((variant) => variant.group === "Estados")).toBe(true);
    expect(variants.some((variant) => variant.step.intent === "adjust_payment")).toBe(true);
    expect(variants.some((variant) => variant.step.intent === "mark_executed")).toBe(true);
    expect(variants.some((variant) => variant.step.disabled || variant.disabled)).toBe(true);
  });
});
