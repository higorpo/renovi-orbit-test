import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS_TAB } from "../provider-budgets.types";

describe("provider-budgets.types", () => {
  it("exposes default budgets tab constant", () => {
    expect(DEFAULT_BUDGETS_TAB).toBe("enviados");
  });
});
