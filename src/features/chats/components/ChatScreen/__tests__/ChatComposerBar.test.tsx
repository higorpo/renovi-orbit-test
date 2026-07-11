// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatComposerBar } from "../ChatComposerBar";
import type { ChatComposerState } from "../../../utils/composerState";
import { CHAT_AUDIO_PERMISSION_COPY } from "../../../utils/chatAudioPermissionCopy";

vi.mock("../../../utils/chatImagePrepare", () => ({
  prepareWebChatImageFile: vi.fn(async (file: File) => file),
  createBlobPreviewAttachment: vi.fn((file: File) => ({
    file,
    previewUrl: "blob:preview",
    revokePreviewOnCleanup: true,
  })),
}));

const nativePickerMocks = vi.hoisted(() => ({
  isNativeAvailable: false,
  pickFromCamera: vi.fn(async () => []),
  pickFromGallery: vi.fn(async () => []),
  getAudioPermissionStatus: vi.fn(async () => "granted" as const),
  canRequestAudioPermission: vi.fn(() => false),
  isAudioPermissionBlocked: vi.fn(() => false),
  requestAudioPermission: vi.fn(async () => "granted" as const),
}));

vi.mock("../../../utils/chatNativeImagePicker", () => ({
  isNativeChatImagePickerAvailable: () => nativePickerMocks.isNativeAvailable,
  isNativeCameraUserCancellation: () => false,
  pickChatImageFromNativeCamera: (...args: unknown[]) =>
    nativePickerMocks.pickFromCamera(...args),
  pickChatImagesFromNativeGallery: (...args: unknown[]) =>
    nativePickerMocks.pickFromGallery(...args),
}));

vi.mock("@/lib/capacitor/audioPermission", () => ({
  getAudioRecordingPermissionStatus: (...args: unknown[]) =>
    nativePickerMocks.getAudioPermissionStatus(...args),
  canRequestAudioRecordingPermission: (...args: unknown[]) =>
    nativePickerMocks.canRequestAudioPermission(...args),
  isAudioRecordingPermissionBlocked: (...args: unknown[]) =>
    nativePickerMocks.isAudioPermissionBlocked(...args),
  requestAudioRecordingPermission: (...args: unknown[]) =>
    nativePickerMocks.requestAudioPermission(...args),
  waitBeforeSystemPermissionPrompt: vi.fn(async () => undefined),
}));

vi.mock("@/lib/capacitor/openAppSettings", () => ({
  openAppSettings: vi.fn(async () => undefined),
}));

vi.mock("@/lib/capacitor/audioRecorder", () => ({
  startChatAudioRecording: vi.fn(async () => undefined),
  stopChatAudioRecordingAsFile: vi.fn(async () => ({
    file: new File(["audio"], "voice.webm", { type: "audio/webm" }),
    durationMs: 2000,
  })),
  cancelChatAudioRecording: vi.fn(async () => undefined),
  getChatAudioAmplitude: vi.fn(async () => 0.2),
}));

const enabledComposer: ChatComposerState = {
  isInputEnabled: true,
  isAttachmentEnabled: true,
  isSendEnabled: true,
  disabledReason: null,
  helperText: null,
  placeholder: "Escreva uma mensagem…",
};

describe("ChatComposerBar", () => {
  beforeEach(() => {
    nativePickerMocks.isNativeAvailable = false;
    nativePickerMocks.pickFromCamera.mockClear();
    nativePickerMocks.pickFromGallery.mockClear();
    nativePickerMocks.getAudioPermissionStatus.mockReset();
    nativePickerMocks.getAudioPermissionStatus.mockResolvedValue("granted");
    nativePickerMocks.canRequestAudioPermission.mockReturnValue(false);
    nativePickerMocks.isAudioPermissionBlocked.mockReturnValue(false);
    nativePickerMocks.requestAudioPermission.mockResolvedValue("granted");
  });

  it("shows image preview after file selection without sending", async () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatComposerBar composer={enabledComposer} onSend={onSend} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "shot.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByAltText("Anexo 1")).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("enables send when only images are attached", async () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatComposerBar composer={enabledComposer} onSend={onSend} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });

    const sendButton = screen.getByRole("button", { name: "Enviar mensagem" });
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
  });

  it("sends text and files together on submit", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ChatComposerBar composer={enabledComposer} onSend={onSend} />,
    );

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    fireEvent.change(screen.getByPlaceholderText("Escreva uma mensagem…"), {
      target: { value: "Olá com foto" },
    });

    const sendButton = screen.getByRole("button", { name: "Enviar mensagem" });
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
    fireEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledWith({
      text: "Olá com foto",
      files: [expect.any(File)],
    });
  });

  it("keeps the composer enabled while images are uploading", () => {
    const onSend = vi.fn().mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <ChatComposerBar composer={enabledComposer} onSend={onSend} />,
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });

    const sendButton = screen.getByRole("button", { name: "Enviar mensagem" });
    return waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    }).then(() => {
      fireEvent.click(sendButton);
      expect(screen.getByPlaceholderText("Escreva uma mensagem…")).not.toBeDisabled();
      expect(screen.queryByText(/Enviando/i)).toBeNull();
    });
  });

  it("keeps the composer enabled while a text send is still in flight", () => {
    const onSend = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<ChatComposerBar composer={enabledComposer} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText("Escreva uma mensagem…");
    fireEvent.change(textarea, { target: { value: "Primeira" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(textarea).not.toBeDisabled();
    fireEvent.change(textarea, { target: { value: "Segunda" } });
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).not.toBeDisabled();
  });

  it("shows the audio primary action when the draft is empty and audio is available", () => {
    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Gravar áudio" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
  });

  it("switches to send when the user types in the composer", () => {
    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Escreva uma mensagem…"), {
      target: { value: "Oi" },
    });

    expect(screen.getByRole("button", { name: "Enviar mensagem" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Gravar áudio" })).toBeNull();
  });

  it("switches back to audio when the draft is cleared", () => {
    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Escreva uma mensagem…");
    fireEvent.change(textarea, { target: { value: "Oi" } });
    fireEvent.change(textarea, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Gravar áudio" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
  });

  it("keeps send as the primary action when only images are attached", async () => {
    const onSend = vi.fn();
    const { container } = render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={onSend}
        onSendAudio={vi.fn()}
      />,
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Enviar mensagem" })).not.toBeDisabled();
    });
    expect(screen.queryByRole("button", { name: "Gravar áudio" })).toBeNull();
  });

  it("sends on Enter without Shift and notifies typing stop", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onTypingStopNow = vi.fn();
    const onComposerChange = vi.fn();
    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={onSend}
        onTypingStopNow={onTypingStopNow}
        onComposerChange={onComposerChange}
      />,
    );

    const textarea = screen.getByPlaceholderText("Escreva uma mensagem…");
    fireEvent.change(textarea, { target: { value: "Enter send" } });
    expect(onComposerChange).toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({ text: "Enter send", files: [] });
    });
    expect(onTypingStopNow).toHaveBeenCalled();
  });

  it("shows helper and moderation block messages", () => {
    render(
      <ChatComposerBar
        composer={{
          ...enabledComposer,
          helperText: "Proposta pendente",
        }}
        onSend={vi.fn()}
        sendBlockMessage="Mensagem bloqueada"
      />,
    );

    expect(screen.getByText("Proposta pendente")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem bloqueada");
  });

  it("opens the native attachment source sheet and picks camera", async () => {
    nativePickerMocks.isNativeAvailable = true;
    nativePickerMocks.pickFromCamera.mockResolvedValue([]);

    render(<ChatComposerBar composer={enabledComposer} onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Anexar foto" }));
    fireEvent.click(await screen.findByRole("button", { name: /Tirar foto/i }));

    await waitFor(() => expect(nativePickerMocks.pickFromCamera).toHaveBeenCalled());
  });

  it("picks gallery from the native attachment source sheet", async () => {
    nativePickerMocks.isNativeAvailable = true;
    nativePickerMocks.pickFromGallery.mockResolvedValue([]);

    render(<ChatComposerBar composer={enabledComposer} onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Anexar foto" }));
    fireEvent.click(await screen.findByRole("button", { name: /Escolher da galeria/i }));

    await waitFor(() => expect(nativePickerMocks.pickFromGallery).toHaveBeenCalled());
  });

  it("opens the audio recording sheet when mic permission is granted", async () => {
    const onSendAudio = vi.fn();
    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={onSendAudio}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));

    expect(await screen.findByRole("button", { name: "Enviar" })).toBeTruthy();

    // Wait for minimum recording duration used by the sheet.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(onSendAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.any(File),
          durationMs: expect.any(Number),
        }),
      );
    });
  });

  it("shows the pre-permission dialog when mic can be requested", async () => {
    nativePickerMocks.getAudioPermissionStatus.mockResolvedValue("prompt");
    nativePickerMocks.canRequestAudioPermission.mockReturnValue(true);

    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));

    expect(await screen.findByRole("button", { name: /Permitir|Continuar|Aceitar/i })).toBeTruthy();
  });

  it("shows the blocked permission dialog when mic access is denied", async () => {
    nativePickerMocks.getAudioPermissionStatus.mockResolvedValue("denied");
    nativePickerMocks.isAudioPermissionBlocked.mockReturnValue(true);

    render(
      <ChatComposerBar
        composer={enabledComposer}
        onSend={vi.fn()}
        onSendAudio={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));

    expect(await screen.findByRole("button", { name: "Fechar" })).toBeTruthy();
    expect(screen.getByText(CHAT_AUDIO_PERMISSION_COPY.blockedTitle)).toBeTruthy();
  });
});
