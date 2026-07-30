import { afterEach, describe, expect, it, vi } from "vitest";
import { isClearSaleProductionFailClosed } from "../isClearSaleProductionFailClosed";

describe("isClearSaleProductionFailClosed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true in production builds (fail closed)", () => {
    vi.stubEnv("PROD", true);
    expect(isClearSaleProductionFailClosed()).toBe(true);
  });

  it("returns false outside production (degrade gracefully)", () => {
    vi.stubEnv("PROD", false);
    expect(isClearSaleProductionFailClosed()).toBe(false);
  });
});
