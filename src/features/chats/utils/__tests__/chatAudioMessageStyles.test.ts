import { describe, expect, it } from "vitest";
import {
  getChatAudioErrorClassName,
  getChatAudioPlayButtonClassName,
  getChatAudioRangeClassName,
  getChatAudioRangeProgressStyle,
  getChatAudioSpeedButtonClassName,
  getChatAudioTimeClassName,
} from "../chatAudioMessageStyles";

describe("chatAudioMessageStyles", () => {
  it("uses primary-foreground tones on outgoing bubbles", () => {
    expect(getChatAudioPlayButtonClassName(true)).toContain("text-primary-foreground");
    expect(getChatAudioRangeClassName(true)).toContain("primary-foreground");
    expect(getChatAudioTimeClassName(true)).toContain("text-primary-foreground/80");
    expect(getChatAudioSpeedButtonClassName(true)).toContain("bg-primary-foreground/10");
    expect(getChatAudioErrorClassName(true)).toContain("text-primary-foreground/90");
  });

  it("uses foreground and primary tones on incoming bubbles", () => {
    expect(getChatAudioPlayButtonClassName(false)).toContain("bg-primary");
    expect(getChatAudioRangeClassName(false)).toContain("hsl(var(--primary))");
    expect(getChatAudioTimeClassName(false)).toContain("text-muted-foreground");
    expect(getChatAudioSpeedButtonClassName(false)).toContain("text-foreground");
    expect(getChatAudioErrorClassName(false)).toContain("text-destructive");
  });

  it("clamps range progress CSS custom property between 0 and 100", () => {
    expect(getChatAudioRangeProgressStyle(42)).toEqual({
      "--chat-audio-range-progress": "42%",
    });
    expect(getChatAudioRangeProgressStyle(-10)).toEqual({
      "--chat-audio-range-progress": "0%",
    });
    expect(getChatAudioRangeProgressStyle(150)).toEqual({
      "--chat-audio-range-progress": "100%",
    });
  });
});
