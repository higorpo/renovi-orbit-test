import { describe, expect, it } from "vitest";
import { STATUS_TAB_DISPLAY } from "../statusTabDisplay";
import { STATUS_TABS } from "../statusTabs";

describe("STATUS_TAB_DISPLAY", () => {
  it("defines display config for every status tab", () => {
    for (const tab of STATUS_TABS) {
      const display = STATUS_TAB_DISPLAY[tab.id];
      expect(display.Icon).toBeTruthy();
      expect(display.iconColor).toBeTruthy();
    }
  });

  it("uses distinct active backgrounds for phase tabs", () => {
    expect(STATUS_TAB_DISPLAY.negotiation.activeBg).toContain("orange");
    expect(STATUS_TAB_DISPLAY.in_progress.activeBg).toContain("blue");
    expect(STATUS_TAB_DISPLAY.completed.activeBg).toContain("green");
    expect(STATUS_TAB_DISPLAY.cancelled.activeBg).toContain("gray");
    expect(STATUS_TAB_DISPLAY.dispute.activeBg).toContain("red");
  });
});
