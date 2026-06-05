import { describe, expect, it, afterEach } from "vitest";
import {
  claimChatAudioPlayback,
  registerChatAudioPlaybackOwner,
  releaseChatAudioPlayback,
  resetChatAudioPlaybackCoordinator,
} from "../chatAudioPlaybackCoordinator";

describe("chatAudioPlaybackCoordinator", () => {
  afterEach(() => {
    resetChatAudioPlaybackCoordinator();
  });

  it("stops the previous owner when a new owner claims playback", () => {
    const stops: string[] = [];

    registerChatAudioPlaybackOwner("audio-a", () => {
      stops.push("audio-a");
    });
    registerChatAudioPlaybackOwner("audio-b", () => {
      stops.push("audio-b");
    });

    claimChatAudioPlayback("audio-a");
    claimChatAudioPlayback("audio-b");

    expect(stops).toEqual(["audio-a"]);
  });

  it("does not stop the same owner when reclaiming playback", () => {
    let stopCount = 0;

    registerChatAudioPlaybackOwner("audio-a", () => {
      stopCount += 1;
    });

    claimChatAudioPlayback("audio-a");
    claimChatAudioPlayback("audio-a");

    expect(stopCount).toBe(0);
  });

  it("clears active owner on release", () => {
    const stops: string[] = [];

    registerChatAudioPlaybackOwner("audio-a", () => {
      stops.push("audio-a");
    });
    registerChatAudioPlaybackOwner("audio-b", () => {
      stops.push("audio-b");
    });

    claimChatAudioPlayback("audio-a");
    releaseChatAudioPlayback("audio-a");
    claimChatAudioPlayback("audio-b");

    expect(stops).toEqual([]);
  });

  it("clears active owner when unregistering the current owner", () => {
    const stops: string[] = [];

    const unregisterA = registerChatAudioPlaybackOwner("audio-a", () => {
      stops.push("audio-a");
    });
    registerChatAudioPlaybackOwner("audio-b", () => {
      stops.push("audio-b");
    });

    claimChatAudioPlayback("audio-a");
    unregisterA();
    claimChatAudioPlayback("audio-b");

    expect(stops).toEqual([]);
  });
});
