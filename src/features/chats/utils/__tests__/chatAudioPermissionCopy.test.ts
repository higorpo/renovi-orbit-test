import { describe, expect, it } from "vitest";
import { CHAT_AUDIO_PERMISSION_COPY } from "../chatAudioPermissionCopy";

describe("CHAT_AUDIO_PERMISSION_COPY", () => {
  it("includes request and blocked microphone copy", () => {
    expect(CHAT_AUDIO_PERMISSION_COPY.title).toMatch(/microfone/i);
    expect(CHAT_AUDIO_PERMISSION_COPY.benefits).toMatch(/áudio/i);
    expect(CHAT_AUDIO_PERMISSION_COPY.blockedTitle).toMatch(/bloqueado/i);
    expect(CHAT_AUDIO_PERMISSION_COPY.webSettingsHint).toMatch(/navegador/i);
  });
});
