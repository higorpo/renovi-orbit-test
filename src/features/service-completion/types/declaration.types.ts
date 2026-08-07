/**
 * Device metadata for client execution declaration (no GPS / push).
 */

export type DeviceDeclarationPayload = {
  deviceId: string | null;
  platform: string;
  operatingSystem: string | null;
  osVersion: string | null;
  manufacturer: string | null;
  model: string | null;
  deviceName: string | null;
  isVirtual: boolean | null;
  webViewVersion: string | null;
  userAgent: string | null;
  clientTimezone: string | null;
};
