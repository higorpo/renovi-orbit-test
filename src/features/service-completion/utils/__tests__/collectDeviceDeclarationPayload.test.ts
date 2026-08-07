// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectDeviceDeclarationPayload } from "../collectDeviceDeclarationPayload";

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: vi.fn(() => "web") },
}));

vi.mock("@capacitor/device", () => ({
  Device: {
    getId: vi.fn().mockResolvedValue({ identifier: "device-decl-1" }),
    getInfo: vi.fn().mockResolvedValue({
      operatingSystem: "linux",
      osVersion: "6.1",
      manufacturer: null,
      model: "Desktop",
      name: "Browser",
      isVirtual: false,
      webViewVersion: null,
    }),
  },
}));

describe("collectDeviceDeclarationPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 Test" },
    });
  });

  it("builds payload from Capacitor Device without location fields", async () => {
    const payload = await collectDeviceDeclarationPayload();
    expect(payload).toMatchObject({
      deviceId: "device-decl-1",
      platform: "web",
      operatingSystem: "linux",
      model: "Desktop",
      userAgent: "Mozilla/5.0 Test",
    });
    expect(payload.clientTimezone).toBeTruthy();
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("fcm_token");
  });
});
