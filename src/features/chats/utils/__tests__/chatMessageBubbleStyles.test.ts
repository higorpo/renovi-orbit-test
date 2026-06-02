import { describe, expect, it } from "vitest";
import { getChatMessageBubbleClassName } from "../chatMessageBubbleStyles";

describe("getChatMessageBubbleClassName", () => {
  it("matches outgoing single text bubble styles", () => {
    const className = getChatMessageBubbleClassName({
      isOutgoing: true,
      groupPosition: "single",
    });
    expect(className).toContain("bg-primary");
    expect(className).toContain("text-primary-foreground");
    expect(className).toContain("rounded-br-md");
    expect(className).toContain("rounded-2xl");
  });

  it("matches incoming single text bubble styles", () => {
    const className = getChatMessageBubbleClassName({
      isOutgoing: false,
      groupPosition: "single",
    });
    expect(className).toContain("bg-muted");
    expect(className).toContain("rounded-bl-md");
    expect(className).toContain("rounded-2xl");
  });

  it("flattens top corners for outgoing last message in a group", () => {
    const className = getChatMessageBubbleClassName({
      isOutgoing: true,
      groupPosition: "last",
    });
    expect(className).toContain("rounded-tr-md");
    expect(className).toContain("rounded-br-md");
    expect(className).not.toContain("rounded-2xl");
  });

  it("flattens bottom corners for outgoing first message in a group", () => {
    const className = getChatMessageBubbleClassName({
      isOutgoing: true,
      groupPosition: "first",
    });
    expect(className).toContain("rounded-tl-2xl");
    expect(className).toContain("rounded-tr-2xl");
    expect(className).toContain("rounded-bl-2xl");
  });

  it("keeps only side rounding for middle incoming messages", () => {
    const className = getChatMessageBubbleClassName({
      isOutgoing: false,
      groupPosition: "middle",
    });
    expect(className).toContain("rounded-tr-2xl");
    expect(className).toContain("rounded-br-2xl");
    expect(className).toContain("rounded-tl-md");
    expect(className).toContain("rounded-bl-md");
  });
});
