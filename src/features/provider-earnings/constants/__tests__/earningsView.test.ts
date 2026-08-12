import { describe, expect, it } from "vitest";
import {
  DEFAULT_EARNINGS_VIEW,
  EARNINGS_VIEW,
  parseEarningsView,
} from "../earningsView";
import { providerEarningsPath, ROUTE_PROVIDER_EARNINGS } from "../routes";

describe("parseEarningsView", () => {
  it("defaults to deposits", () => {
    expect(parseEarningsView(null)).toBe(EARNINGS_VIEW.deposits);
    expect(parseEarningsView(undefined)).toBe(DEFAULT_EARNINGS_VIEW);
    expect(parseEarningsView("unknown")).toBe(EARNINGS_VIEW.deposits);
  });

  it("accepts charges", () => {
    expect(parseEarningsView("charges")).toBe(EARNINGS_VIEW.charges);
  });
});

describe("providerEarningsPath", () => {
  it("returns the Ganhos path by default", () => {
    expect(providerEarningsPath()).toBe(ROUTE_PROVIDER_EARNINGS);
    expect(providerEarningsPath("deposits")).toBe("/dashboard/settings/earnings");
  });

  it("opens Cobranças via query param", () => {
    expect(providerEarningsPath("charges")).toBe("/dashboard/settings/earnings?view=charges");
  });
});
