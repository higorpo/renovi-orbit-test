// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock("@capgo/capacitor-audio-recorder", () => ({
  CapacitorAudioRecorder: {
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
  },
}));

import {
  canRequestAudioRecordingPermission,
  getAudioRecordingPermissionStatus,
  isAudioRecordingPermissionBlocked,
  requestAudioRecordingPermission,
  waitBeforeSystemPermissionPrompt,
} from "../audioPermission";

describe("audioPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(false);
  });

  it("identifies requestable and blocked permission states", () => {
    expect(canRequestAudioRecordingPermission("prompt")).toBe(true);
    expect(canRequestAudioRecordingPermission("granted")).toBe(false);
    expect(isAudioRecordingPermissionBlocked("denied")).toBe(true);
    expect(isAudioRecordingPermissionBlocked("unsupported")).toBe(false);
  });

  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["prompt", "prompt"],
  ] as const)("maps native check status %s to %s", async (recordAudio, expected) => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.checkPermissions.mockResolvedValue({ recordAudio });

    await expect(getAudioRecordingPermissionStatus()).resolves.toBe(expected);
  });

  it("returns unsupported when web media capture is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });

    await expect(getAudioRecordingPermissionStatus()).resolves.toBe("unsupported");
  });

  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["prompt", "prompt"],
  ] as const)("maps web permission state %s to %s", async (state, expected) => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state }) },
      configurable: true,
    });

    await expect(getAudioRecordingPermissionStatus()).resolves.toBe(expected);
  });

  it("falls back to prompt when the web permission query fails", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockRejectedValue(new Error("unsupported query")) },
      configurable: true,
    });

    await expect(getAudioRecordingPermissionStatus()).resolves.toBe("prompt");
  });

  it("requests native permission and maps the result", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.requestPermissions.mockResolvedValue({ recordAudio: "denied" });

    await expect(requestAudioRecordingPermission()).resolves.toBe("denied");
    expect(mocks.requestPermissions).toHaveBeenCalledOnce();
  });

  it("stops every web media track after permission is granted", async () => {
    const stopFirst = vi.fn();
    const stopSecond = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: stopFirst }, { stop: stopSecond }],
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    await expect(requestAudioRecordingPermission()).resolves.toBe("granted");
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stopFirst).toHaveBeenCalledOnce();
    expect(stopSecond).toHaveBeenCalledOnce();
  });

  it("maps a rejected web prompt to denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("rejected")) },
      configurable: true,
    });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
      configurable: true,
    });

    await expect(requestAudioRecordingPermission()).resolves.toBe("denied");
  });

  it("waits before opening the system prompt", async () => {
    vi.useFakeTimers();
    const pending = waitBeforeSystemPermissionPrompt();
    let resolved = false;
    pending.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(319);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
