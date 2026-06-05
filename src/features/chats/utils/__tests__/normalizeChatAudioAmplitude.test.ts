import { describe, expect, it } from "vitest";
import {
  chatAudioWaveformBarHeight,
  normalizeChatAudioAmplitude,
  smoothChatAudioAmplitude,
} from "../normalizeChatAudioAmplitude";

describe("normalizeChatAudioAmplitude", () => {
  it("returns 0 for invalid or silent input", () => {
    expect(normalizeChatAudioAmplitude(0)).toBe(0);
    expect(normalizeChatAudioAmplitude(-1)).toBe(0);
    expect(normalizeChatAudioAmplitude(Number.NaN)).toBe(0);
  });

  it("boosts low amplitudes for visible waveform bars", () => {
    expect(normalizeChatAudioAmplitude(0.05)).toBeGreaterThan(0.15);
    expect(normalizeChatAudioAmplitude(0.2)).toBeGreaterThan(0.45);
  });

  it("caps output at 1", () => {
    expect(normalizeChatAudioAmplitude(1)).toBeLessThanOrEqual(1);
    expect(normalizeChatAudioAmplitude(100)).toBeLessThanOrEqual(1);
  });
});

describe("smoothChatAudioAmplitude", () => {
  it("rises quickly when amplitude increases", () => {
    expect(smoothChatAudioAmplitude(0.1, 0.8)).toBeGreaterThan(0.5);
  });

  it("decays slowly when amplitude drops", () => {
    const next = smoothChatAudioAmplitude(0.8, 0);
    expect(next).toBeGreaterThan(0.3);
    expect(next).toBeLessThan(0.8);
  });
});

describe("chatAudioWaveformBarHeight", () => {
  it("returns idle height when silent", () => {
    expect(chatAudioWaveformBarHeight(0, 0)).toBe(0.1);
  });

  it("scales bar height with amplitude", () => {
    expect(chatAudioWaveformBarHeight(0.6, 0)).toBeGreaterThan(0.3);
  });
});
