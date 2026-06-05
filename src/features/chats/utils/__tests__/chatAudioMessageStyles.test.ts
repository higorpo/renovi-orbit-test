import { describe, expect, it } from "vitest";
import {
  getChatAudioPlayButtonClassName,
  getChatAudioRangeClassName,
  getChatAudioSpeedButtonClassName,
  getChatAudioTimeClassName,
} from "../chatAudioMessageStyles";

describe("chatAudioMessageStyles", () => {
  it("uses primary-foreground tones on outgoing bubbles", () => {
    expect(getChatAudioPlayButtonClassName(true)).toContain("text-primary-foreground");
    expect(getChatAudioRangeClassName(true)).toContain("primary-foreground");
    expect(getChatAudioTimeClassName(true)).toContain("text-primary-foreground/80");
    expect(getChatAudioSpeedButtonClassName(true)).toContain("bg-primary-foreground/10");
  });

  it("uses foreground and primary tones on incoming bubbles", () => {
    expect(getChatAudioPlayButtonClassName(false)).toContain("bg-primary");
    expect(getChatAudioRangeClassName(false)).toContain("hsl(var(--primary))");
    expect(getChatAudioTimeClassName(false)).toContain("text-muted-foreground");
    expect(getChatAudioSpeedButtonClassName(false)).toContain("text-foreground");
  });
});
