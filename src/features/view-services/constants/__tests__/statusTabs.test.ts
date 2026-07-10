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
  });

  it("returns null for all and dispute tabs", () => {
    expect(statusTabIdToListPhase("all")).toBeNull();
    expect(statusTabIdToListPhase("dispute")).toBeNull();
  });
});

describe("tabIncludesStatus", () => {
  it("includes every phase on the all tab", () => {
    expect(tabIncludesStatus("all", "negotiation")).toBe(true);
    expect(tabIncludesStatus("all", "cancelled")).toBe(true);
  });

  it("includes no phases on the dispute tab", () => {
    expect(tabIncludesStatus("dispute", "negotiation")).toBe(false);
  });

  it("matches only the selected phase tab", () => {
    expect(tabIncludesStatus("completed", "completed")).toBe(true);
    expect(tabIncludesStatus("completed", "negotiation")).toBe(false);
  });
});
