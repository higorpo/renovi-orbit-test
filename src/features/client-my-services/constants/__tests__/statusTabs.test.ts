import { describe, it, expect } from "vitest";
import {
  statusToTabId,
  tabIncludesStatus,
  STATUS_TABS,
} from "../statusTabs";

describe("statusToTabId", () => {
  it("maps open to waiting_proposals", () => {
    expect(statusToTabId("open")).toBe("waiting_proposals");
  });
  it("maps in_progress to in_progress", () => {
    expect(statusToTabId("in_progress")).toBe("in_progress");
  });
  it("maps closed to completed", () => {
    expect(statusToTabId("closed")).toBe("completed");
  });
  it("maps cancelled to cancelled", () => {
    expect(statusToTabId("cancelled")).toBe("cancelled");
  });
});

describe("tabIncludesStatus", () => {
  it("all tab includes any status", () => {
    expect(tabIncludesStatus("all", "open")).toBe(true);
    expect(tabIncludesStatus("all", "cancelled")).toBe(true);
  });
  it("waiting_proposals includes only open", () => {
    expect(tabIncludesStatus("waiting_proposals", "open")).toBe(true);
    expect(tabIncludesStatus("waiting_proposals", "in_progress")).toBe(false);
  });
  it("in_progress includes only in_progress", () => {
    expect(tabIncludesStatus("in_progress", "in_progress")).toBe(true);
    expect(tabIncludesStatus("in_progress", "open")).toBe(false);
  });
});

describe("STATUS_TABS", () => {
  it("has expected tab ids", () => {
    const ids = STATUS_TABS.map((t) => t.id);
    expect(ids).toContain("all");
    expect(ids).toContain("waiting_proposals");
    expect(ids).toContain("in_progress");
    expect(ids).toContain("completed");
    expect(ids).toContain("cancelled");
  });
});
