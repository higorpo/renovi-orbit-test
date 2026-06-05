import { Capacitor } from "@capacitor/core";
import { CapacitorAudioRecorder } from "@capgo/capacitor-audio-recorder";

export type AudioRecordingPermissionStatus = "granted" | "prompt" | "denied" | "unsupported";

const DISMISS_BEFORE_SYSTEM_PROMPT_MS = 320;

export function canRequestAudioRecordingPermission(status: AudioRecordingPermissionStatus): boolean {
  return status === "prompt";
}

export function isAudioRecordingPermissionBlocked(status: AudioRecordingPermissionStatus): boolean {
  return status === "denied";
}

async function getWebMicrophonePermissionStatus(): Promise<AudioRecordingPermissionStatus> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";

  const permissions = navigator.permissions;
  if (permissions?.query) {
    try {
      const result = await permissions.query({ name: "microphone" as PermissionName });
      if (result.state === "granted") return "granted";
      if (result.state === "denied") return "denied";
      return "prompt";
    } catch {
      return "prompt";
    }
  }

  return "prompt";
}

export async function getAudioRecordingPermissionStatus(): Promise<AudioRecordingPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    const status = await CapacitorAudioRecorder.checkPermissions();
    const recordAudio = status.recordAudio;
    if (recordAudio === "granted") return "granted";
    if (recordAudio === "denied") return "denied";
    return "prompt";
  }

  return getWebMicrophonePermissionStatus();
}

export async function requestAudioRecordingPermission(): Promise<AudioRecordingPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    const status = await CapacitorAudioRecorder.requestPermissions();
    if (status.recordAudio === "granted") return "granted";
    if (status.recordAudio === "denied") return "denied";
    return "prompt";
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch {
    const next = await getWebMicrophonePermissionStatus();
    return next === "prompt" ? "denied" : next;
  }
}

export async function waitBeforeSystemPermissionPrompt(): Promise<void> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, DISMISS_BEFORE_SYSTEM_PROMPT_MS);
  });
}
