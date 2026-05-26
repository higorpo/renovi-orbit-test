// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ProviderBudgetsPage } from "../index";

describe("provider-budgets public API", () => {
  it("exports ProviderBudgetsPage", () => {
    expect(ProviderBudgetsPage).toBeTypeOf("function");
  });
});
