export const MAX_AUDIO_DURATION_MS = 120_000;
export const MIN_AUDIO_DURATION_MS = 1_000;
/** Requested encoder rate; native AAC/m4a may exceed this on mobile. */
export const CHAT_AUDIO_BIT_RATE = 32_000;
/** Upper bound for upload size math — aligns with typical native voice encoders. */
export const CHAT_AUDIO_UPLOAD_MAX_BIT_RATE = 128_000;
/** Max bytes for a full 2-minute clip at CHAT_AUDIO_UPLOAD_MAX_BIT_RATE plus headroom. */
export const MAX_AUDIO_BYTES = Math.ceil(
  (CHAT_AUDIO_UPLOAD_MAX_BIT_RATE / 8) * (MAX_AUDIO_DURATION_MS / 1000) * 1.15,
);
export const CHAT_AUDIO_SAMPLE_RATE = 16_000;
export const CHAT_AUDIO_PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
export const CHAT_AUDIO_PREVIEW_LABEL = "Áudio";
export const CHAT_AUDIO_INBOX_PREVIEW = "🎤 Áudio";
