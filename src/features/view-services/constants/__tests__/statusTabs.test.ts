import { describe, expect, it } from "vitest";
import {
  statusTabIdToListPhase,
  statusToTabId,
  tabIncludesStatus,
} from "../statusTabs";

describe("statusToTabId", () => {
  it("maps list phase to the matching tab id", () => {
    expect(statusToTabId("negotiation")).toBe("negotiation");
    expect(statusToTabId("completed")).toBe("completed");
  });
});

describe("statusTabIdToListPhase", () => {
  it("returns the phase for filterable tabs", () => {
    expect(statusTabIdToListPhase("negotiation")).toBe("negotiation");
    expect(statusTabIdToListPhase("in_progress")).toBe("in_progress");
    expect(statusTabIdToListPhase("completed")).toBe("completed");
    expect(statusTabIdToListPhase("cancelled")).toBe("cancelled");
    expect(statusTabIdToListPhase("dispute")).toBe("dispute");
  });

  it("returns null for the all tab", () => {
    expect(statusTabIdToListPhase("all")).toBeNull();
  });
});

describe("tabIncludesStatus", () => {
  it("includes every phase on the all tab", () => {
    expect(tabIncludesStatus("all", "negotiation")).toBe(true);
    expect(tabIncludesStatus("all", "cancelled")).toBe(true);
    expect(tabIncludesStatus("all", "dispute")).toBe(true);
  });

  it("matches dispute tab only for dispute phase", () => {
    expect(tabIncludesStatus("dispute", "dispute")).toBe(true);
    expect(tabIncludesStatus("dispute", "negotiation")).toBe(false);
  });

  it("matches only the selected phase tab", () => {
    expect(tabIncludesStatus("completed", "completed")).toBe(true);
    expect(tabIncludesStatus("completed", "negotiation")).toBe(false);
  });
});
