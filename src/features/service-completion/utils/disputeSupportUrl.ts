/**
 * Dispute stub support URL resolution (design §11.6 / Task 52).
 * Remote override `orbit.dispute_support_url` wins over env when present.
 */

export const DISPUTE_SUPPORT_ENV_KEY =
  "VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL";

export const DISPUTE_STUB_ANALYTICS_EVENT =
  "service_completion_dispute_stub_opened";

type OrbitRemoteConfigWindow = Window & {
  __ORBIT_REMOTE_CONFIG__?: Record<string, unknown>;
};

function readOrbitRemoteDisputeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const cfg = (window as OrbitRemoteConfigWindow).__ORBIT_REMOTE_CONFIG__;
  if (!cfg || typeof cfg !== "object") return null;

  const candidates = [
    cfg["orbit.dispute_support_url"],
    cfg.dispute_support_url,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readEnvDisputeUrl(): string | null {
  const raw = import.meta.env.VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Returns a validated http(s) URL or null. */
export function resolveDisputeSupportUrl(
  remoteOverride?: string | null,
): string | null {
  const candidate =
    (typeof remoteOverride === "string" && remoteOverride.trim()) ||
    readOrbitRemoteDisputeUrl() ||
    readEnvDisputeUrl();

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function openExternalSupportUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
