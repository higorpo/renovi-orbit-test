import { Capacitor } from "@capacitor/core";
import {
  CapacitorAudioRecorder,
  RecordingStatus,
  type StopRecordingResult,
} from "@capgo/capacitor-audio-recorder";
import {
  CHAT_AUDIO_BIT_RATE,
  CHAT_AUDIO_SAMPLE_RATE,
} from "@/features/chats/utils/chatAudioConstants";
import { resolveChatAudioMimeType } from "@/features/chats/utils/chatAudioValidation";

export { RecordingStatus };

export async function startChatAudioRecording(): Promise<void> {
  await CapacitorAudioRecorder.startRecording({
    bitRate: CHAT_AUDIO_BIT_RATE,
    sampleRate: CHAT_AUDIO_SAMPLE_RATE,
  });
}

export async function stopChatAudioRecording(): Promise<StopRecordingResult> {
  return CapacitorAudioRecorder.stopRecording();
}

export async function cancelChatAudioRecording(): Promise<void> {
  await CapacitorAudioRecorder.cancelRecording();
}

export async function getChatAudioAmplitude(): Promise<number> {
  const result = await CapacitorAudioRecorder.getCurrentAmplitude();
  return result.value;
}

export async function getChatAudioRecordingStatus(): Promise<RecordingStatus> {
  const result = await CapacitorAudioRecorder.getRecordingStatus();
  return result.status;
}

const NATIVE_FALLBACK_NAME = "voice-message.m4a";
const WEB_FALLBACK_NAME = "voice-message.webm";

export async function stopChatAudioRecordingAsFile(
  fallbackName = Capacitor.isNativePlatform() ? NATIVE_FALLBACK_NAME : WEB_FALLBACK_NAME,
): Promise<{ file: File; durationMs: number }> {
  const result = await stopChatAudioRecording();
  const durationMs = Math.max(0, Math.round(result.duration ?? 0));

  if (result.blob) {
    const mimeType = resolveChatAudioMimeType(result.blob.type, fallbackName);
    const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "aac";
    return {
      file: new File([result.blob], fallbackName.replace(/\.\w+$/, `.${extension}`), {
        type: mimeType,
      }),
      durationMs: durationMs || estimateDurationFromBlob(result.blob),
    };
  }

  if (!result.uri) {
    throw new Error("Recording result missing audio data");
  }

  const file = await readNativeRecordingFile(result.uri, fallbackName);
  return { file, durationMs: durationMs || 0 };
}

async function readNativeRecordingFile(uri: string, fallbackName: string): Promise<File> {
  const webPath = Capacitor.convertFileSrc(uri);
  const response = await fetch(webPath);
  if (!response.ok) {
    throw new Error("Failed to read recorded audio file");
  }
  const blob = await response.blob();
  const mimeType = resolveChatAudioMimeType(blob.type, uri);
  const fileName = fileNameFromUri(uri) ?? fallbackName;
  return new File([blob], fileName, { type: mimeType });
}

function fileNameFromUri(uri: string): string | null {
  const segment = uri.split(/[?#]/)[0]?.split("/").pop();
  return segment || null;
}

function estimateDurationFromBlob(blob: Blob): number {
  // Fallback when plugin omits duration on web; rough estimate at ~32 kbps.
  return Math.round((blob.size * 8) / 32000) * 1000;
}
