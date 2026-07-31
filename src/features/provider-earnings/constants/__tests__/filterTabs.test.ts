import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTLEMENT_FILTER_ID,
  getSettlementFilterConfig,
  SETTLEMENT_FILTER_TABS,
} from "../filterTabs";
import type { SettlementFilterId } from "../../types/settlements.types";
import { ROUTE_PROVIDER_EARNINGS } from "../routes";

describe("getSettlementFilterConfig", () => {
  it("returns matching tab config", () => {
    expect(getSettlementFilterConfig("pending")).toEqual(
      expect.objectContaining({ id: "pending", movementStatus: "PENDING" }),
    );
    expect(getSettlementFilterConfig("debit")).toEqual(
      expect.objectContaining({ id: "debit", recordType: "DEBIT" }),
    );
  });

  it("falls back to default tab for unknown filter id", () => {
    const unknown = "unknown" as SettlementFilterId;
    expect(getSettlementFilterConfig(unknown)).toEqual(SETTLEMENT_FILTER_TABS[0]);
    expect(DEFAULT_SETTLEMENT_FILTER_ID).toBe("all");
  });
});

describe("ROUTE_PROVIDER_EARNINGS", () => {
  it("exposes dashboard earnings path", () => {
    expect(ROUTE_PROVIDER_EARNINGS).toBe("/dashboard/earnings");
  });
});
