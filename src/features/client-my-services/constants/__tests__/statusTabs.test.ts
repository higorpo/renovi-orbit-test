import { describe, it, expect } from "vitest";
import { statusToTabId, tabIncludesStatus, STATUS_TABS } from "../statusTabs";

describe("statusToTabId", () => {
  it("maps list phase to same tab id", () => {
    expect(statusToTabId("negotiation")).toBe("negotiation");
    expect(statusToTabId("in_progress")).toBe("in_progress");
    expect(statusToTabId("completed")).toBe("completed");
    expect(statusToTabId("cancelled")).toBe("cancelled");
  });
});

describe("tabIncludesStatus", () => {
  it("all tab includes any phase", () => {
    expect(tabIncludesStatus("all", "negotiation")).toBe(true);
    expect(tabIncludesStatus("all", "cancelled")).toBe(true);
  });

  it("phase tabs match only their phase", () => {
    expect(tabIncludesStatus("negotiation", "negotiation")).toBe(true);
    expect(tabIncludesStatus("negotiation", "in_progress")).toBe(false);
    expect(tabIncludesStatus("in_progress", "in_progress")).toBe(true);
  });

  it("dispute tab does not include any phase", () => {
    expect(tabIncludesStatus("dispute", "negotiation")).toBe(false);
  });
});

describe("STATUS_TABS", () => {
  it("has expected tab ids without waiting_proposals", () => {
    const ids = STATUS_TABS.map((t) => t.id);
    expect(ids).toEqual([
      "all",
      "negotiation",
      "in_progress",
      "completed",
      "cancelled",
      "dispute",
    ]);
  });
});
