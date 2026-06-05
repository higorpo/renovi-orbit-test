import { CHAT_AUDIO_PREVIEW_LABEL } from "./chatAudioConstants";

export interface ChatAudioMessagePayload {
  upload_session_id: string;
  path: string;
  duration_ms: number;
  mime_type: string;
  preview?: string;
}

export function getChatAudioPathFromPayload(payload: Record<string, unknown>): string | null {
  const path = payload.path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function getChatAudioDurationMs(payload: Record<string, unknown>): number {
  const value = payload.duration_ms;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildAudioMessageSendPayload(input: {
  uploadSessionId: string;
  path: string;
  durationMs: number;
  mimeType: string;
}): ChatAudioMessagePayload {
  return {
    upload_session_id: input.uploadSessionId,
    path: input.path,
    duration_ms: input.durationMs,
    mime_type: input.mimeType,
    preview: CHAT_AUDIO_PREVIEW_LABEL,
  };
}
