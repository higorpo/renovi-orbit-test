import { describe, expect, it } from "vitest";
import { getChatMessageBubbleClassName } from "../chatMessageBubbleStyles";

describe("getChatMessageBubbleClassName", () => {
  it("matches outgoing text bubble styles", () => {
    const className = getChatMessageBubbleClassName({ isOutgoing: true });
    expect(className).toContain("bg-primary");
    expect(className).toContain("text-primary-foreground");
    expect(className).toContain("rounded-br-md");
  });

  it("matches incoming text bubble styles", () => {
    const className = getChatMessageBubbleClassName({ isOutgoing: false });
    expect(className).toContain("bg-muted");
    expect(className).toContain("rounded-bl-md");
  });
});
