import { Capacitor } from "@capacitor/core";

/**
 * Maps Capgo amplitude (0–1, platform-dependent) to a display-friendly 0–1 level.
 * iOS reports average power; Android peak-since-last-poll — both need extra gain.
 */
export function normalizeChatAudioAmplitude(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  const linear = raw > 1 ? Math.min(raw / 100, 1) : Math.min(Math.max(raw, 0), 1);
  const platform = Capacitor.getPlatform();
  const gain = platform === "ios" ? 6 : platform === "android" ? 4.5 : 4;

  const boosted = 1 - Math.exp(-linear * gain);
  return Math.min(1, boosted);
}

/** Fast attack / slow release so bars react quickly but do not flicker. */
export function smoothChatAudioAmplitude(previous: number, next: number): number {
  const normalized = normalizeChatAudioAmplitude(next);
  if (normalized >= previous) return normalized;
  return previous * 0.55 + normalized * 0.45;
}

export function chatAudioWaveformBarHeight(
  amplitude: number,
  barIndex: number,
  barCount = 16,
): number {
  const idle = 0.1;
  if (amplitude <= 0) return idle;

  const phase = (barIndex / barCount) * Math.PI * 2;
  const variation = 0.72 + 0.28 * Math.abs(Math.sin(phase + amplitude * 4));
  return Math.min(1, Math.max(idle, amplitude * variation));
}
