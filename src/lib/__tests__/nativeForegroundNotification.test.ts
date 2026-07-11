// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => "web"),
}));

const localNotificationsMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
  requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
  createChannel: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorMocks,
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: localNotificationsMocks,
}));

vi.mock("../logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "../logger";
import {
  ANDROID_NOTIFICATION_ICON_COLOR,
  ANDROID_NOTIFICATION_LARGE_ICON,
  ANDROID_NOTIFICATION_SMALL_ICON,
  ensureNativeForegroundNotificationChannel,
  NATIVE_FOREGROUND_PUSH_CHANNEL_ID,
  resetNativeForegroundNotificationForTests,
  showNativeForegroundLocalNotification,
  syncNativeLocalNotificationPermission,
} from "../nativeForegroundNotification";

describe("nativeForegroundNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNativeForegroundNotificationForTests();
    capacitorMocks.getPlatform.mockReturnValue("web");
    localNotificationsMocks.checkPermissions.mockResolvedValue({ display: "granted" });
    localNotificationsMocks.requestPermissions.mockResolvedValue({ display: "granted" });
  });

  it("skips channel creation on non-Android platforms", async () => {
    await ensureNativeForegroundNotificationChannel();
    expect(localNotificationsMocks.createChannel).not.toHaveBeenCalled();

    // Second call should stay idempotent after channelReady is set.
    await ensureNativeForegroundNotificationChannel();
    expect(localNotificationsMocks.createChannel).not.toHaveBeenCalled();
  });

  it("creates the Android notification channel once", async () => {
    capacitorMocks.getPlatform.mockReturnValue("android");

    await ensureNativeForegroundNotificationChannel();
    await ensureNativeForegroundNotificationChannel();

    expect(localNotificationsMocks.createChannel).toHaveBeenCalledOnce();
    expect(localNotificationsMocks.createChannel).toHaveBeenCalledWith({
      id: NATIVE_FOREGROUND_PUSH_CHANNEL_ID,
      name: "Notificações",
      importance: 5,
      visibility: 1,
    });
  });

  it("returns true when local notification permission is already granted", async () => {
    await expect(
      syncNativeLocalNotificationPermission({ requestIfNeeded: false }),
    ).resolves.toBe(true);
    expect(localNotificationsMocks.requestPermissions).not.toHaveBeenCalled();
  });

  it("returns false when permission is denied and request is not allowed", async () => {
    localNotificationsMocks.checkPermissions.mockResolvedValue({ display: "denied" });

    await expect(
      syncNativeLocalNotificationPermission({ requestIfNeeded: false }),
    ).resolves.toBe(false);
  });

  it("requests permission when needed and returns the result", async () => {
    localNotificationsMocks.checkPermissions.mockResolvedValue({ display: "prompt" });
    localNotificationsMocks.requestPermissions.mockResolvedValue({ display: "granted" });

    await expect(
      syncNativeLocalNotificationPermission({ requestIfNeeded: true }),
    ).resolves.toBe(true);
    expect(localNotificationsMocks.requestPermissions).toHaveBeenCalledOnce();
  });

  it("skips scheduling when display permission is not granted", async () => {
    localNotificationsMocks.checkPermissions.mockResolvedValue({ display: "denied" });

    await showNativeForegroundLocalNotification(
      { data: { conversationId: "c1" } },
      { title: "Oi", body: "Mensagem", tag: "tag-1" },
    );

    expect(localNotificationsMocks.schedule).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it("schedules Android notifications with channel and icons", async () => {
    capacitorMocks.getPlatform.mockReturnValue("android");

    await showNativeForegroundLocalNotification(
      { data: { conversationId: "c1" } },
      { title: "Oi", body: "Mensagem", tag: "tag-1" },
    );

    expect(localNotificationsMocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          title: "Oi",
          body: "Mensagem",
          channelId: NATIVE_FOREGROUND_PUSH_CHANNEL_ID,
          group: "tag-1",
          extra: { conversationId: "c1" },
          smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
          largeIcon: ANDROID_NOTIFICATION_LARGE_ICON,
          iconColor: ANDROID_NOTIFICATION_ICON_COLOR,
        }),
      ],
    });
  });

  it("schedules iOS notifications without Android-only fields", async () => {
    capacitorMocks.getPlatform.mockReturnValue("ios");

    await showNativeForegroundLocalNotification(
      { data: { conversationId: "c2" } },
      { title: "Hello", body: "Body", tag: "tag-2" },
    );

    const scheduled = localNotificationsMocks.schedule.mock.calls[0]?.[0];
    expect(scheduled.notifications[0].channelId).toBeUndefined();
    expect(scheduled.notifications[0].smallIcon).toBeUndefined();
  });
});
