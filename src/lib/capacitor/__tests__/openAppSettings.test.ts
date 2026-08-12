// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isNativePlatformMock, getPlatformMock, getInfoMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(),
  getPlatformMock: vi.fn(),
  getInfoMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: (...args: unknown[]) => isNativePlatformMock(...args),
    getPlatform: (...args: unknown[]) => getPlatformMock(...args),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    getInfo: (...args: unknown[]) => getInfoMock(...args),
  },
}));

import { openAppSettings } from "../openAppSettings";

describe("openAppSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
  });

  it("returns false on web", async () => {
    isNativePlatformMock.mockReturnValue(false);

    await expect(openAppSettings()).resolves.toBe(false);
    expect(getPlatformMock).not.toHaveBeenCalled();
  });

  it("opens iOS app-settings URL", async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPlatformMock.mockReturnValue("ios");

    await expect(openAppSettings()).resolves.toBe(true);
    expect(window.open).toHaveBeenCalledWith("app-settings:", "_system");
    expect(getInfoMock).not.toHaveBeenCalled();
  });

  it("navigates to Android application details intent", async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPlatformMock.mockReturnValue("android");
    getInfoMock.mockResolvedValue({ id: "com.prestway.orbit" });

    await expect(openAppSettings()).resolves.toBe(true);
    expect(window.location.href).toContain(
      "android.settings.APPLICATION_DETAILS_SETTINGS",
    );
    expect(window.location.href).toContain("com.prestway.orbit");
  });

  it("returns false when native open throws", async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPlatformMock.mockReturnValue("ios");
    vi.mocked(window.open).mockImplementation(() => {
      throw new Error("blocked");
    });

    await expect(openAppSettings()).resolves.toBe(false);
  });

  it("returns false when Android getInfo throws", async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPlatformMock.mockReturnValue("android");
    getInfoMock.mockRejectedValue(new Error("unavailable"));

    await expect(openAppSettings()).resolves.toBe(false);
  });
});
