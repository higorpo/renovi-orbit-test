// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposerBar } from "../ChatComposerBar";
import type { ChatComposerState } from "../../../utils/composerState";

vi.mock("../../../utils/chatImagePrepare", () => ({
  prepareWebChatImageFile: vi.fn(async (file: File) => file),
  createBlobPreviewAttachment: vi.fn((file: File) => ({
    file,
    previewUrl: "blob:preview",
    revokePreviewOnCleanup: true,
  })),
}));

vi.mock("../../../utils/chatNativeImagePicker", () => ({
  isNativeChatImagePickerAvailable: () => false,
  isNativeCameraUserCancellation: () => false,
  pickChatImageFromNativeCamera: vi.fn(),
  pickChatImagesFromNativeGallery: vi.fn(),
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
});
