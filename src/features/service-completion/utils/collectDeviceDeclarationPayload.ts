import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";

import type { DeviceDeclarationPayload } from "../types/declaration.types";

function resolveTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function resolveUserAgent(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent?.trim();
  return ua && ua.length > 0 ? ua : null;
}

/**
 * Collects Capacitor device metadata for execution declaration.
 * Falls back to web userAgent; never requests geolocation.
 */
export async function collectDeviceDeclarationPayload(): Promise<DeviceDeclarationPayload> {
  const [{ identifier }, info] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
  ]);

  return {
    deviceId: identifier ?? null,
    platform: Capacitor.getPlatform(),
    operatingSystem: info.operatingSystem ?? null,
    osVersion: info.osVersion ?? null,
    manufacturer: info.manufacturer ?? null,
    model: info.model ?? null,
    deviceName: info.name ?? null,
    isVirtual: info.isVirtual ?? null,
    webViewVersion: info.webViewVersion ?? null,
    userAgent: resolveUserAgent(),
    clientTimezone: resolveTimezone(),
  };
}
