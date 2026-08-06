import { describe, expect, it } from "vitest";
import { getClientCardTheme } from "../clientServiceCardTheme";

describe("getClientCardTheme", () => {
  it("applies urgent highlight regardless of phase", () => {
    const theme = getClientCardTheme("in_progress", "urgent");
    expect(theme.highlight.box).toContain("orange");
    expect(theme.phaseBadge).toContain("primary");
  });

  it("uses amber attention styling in negotiation", () => {
    const theme = getClientCardTheme("negotiation", "attention");
    expect(theme.highlight.box).toContain("amber");
    expect(theme.phaseBadge).toContain("amber");
  });

  it("uses stronger primary attention styling for in-progress follow-ups", () => {
    const theme = getClientCardTheme("in_progress", "attention");
    expect(theme.highlight.box).toContain("primary/30");
  });

  it("uses muted negotiation highlight for default emphasis", () => {
    const theme = getClientCardTheme("negotiation", "default");
    expect(theme.highlight.box).toContain("muted");
  });

  it("uses emerald highlight for completed services", () => {
    const theme = getClientCardTheme("completed", "default");
    expect(theme.highlight.box).toContain("emerald");
    expect(theme.phaseBadge).toContain("emerald");
  });

  it("uses rose highlight for error and cancelled emphasis", () => {
    expect(getClientCardTheme("in_progress", "error").highlight.box).toContain("rose");
    expect(getClientCardTheme("cancelled", "cancelled").highlight.box).toContain("rose");
  });

  it("adds today and cancelled card accents", () => {
    const today = getClientCardTheme("in_progress", "default", { isTodayService: true });
    expect(today.card).toContain("orange");

    const cancelled = getClientCardTheme("cancelled", "default");
    expect(cancelled.card).toContain("rose");
  });
});
