import { describe, expect, it } from "vitest";
import { getProviderCardTheme } from "../providerServiceCardTheme";

describe("getProviderCardTheme", () => {
  it("applies urgent highlight regardless of phase", () => {
    const theme = getProviderCardTheme("completed", "urgent");
    expect(theme.highlight.box).toContain("orange");
  });

  it("uses stronger primary attention styling in progress", () => {
    const attention = getProviderCardTheme("in_progress", "attention");
    const normal = getProviderCardTheme("in_progress", "default");
    expect(attention.highlight.box).toContain("primary/30");
    expect(normal.highlight.box).toContain("primary/20");
  });

  it("uses amber attention styling in negotiation", () => {
    const theme = getProviderCardTheme("negotiation", "attention");
    expect(theme.highlight.box).toContain("amber");
  });

  it("uses muted negotiation highlight for default emphasis", () => {
    expect(getProviderCardTheme("negotiation", "default").highlight.box).toContain("muted");
  });

  it("uses emerald highlight for completed services", () => {
    expect(getProviderCardTheme("completed", "default").highlight.box).toContain("emerald");
  });

  it("uses rose highlight for cancelled emphasis and cancelled phase", () => {
    expect(getProviderCardTheme("in_progress", "cancelled").highlight.box).toContain("rose");
    expect(getProviderCardTheme("cancelled", "default").highlight.box).toContain("rose");
    expect(getProviderCardTheme("cancelled", "default").card).toContain("rose");
  });

  it("adds today service card accent", () => {
    const theme = getProviderCardTheme("in_progress", "default", { isTodayService: true });
    expect(theme.card).toContain("orange");
  });
});
