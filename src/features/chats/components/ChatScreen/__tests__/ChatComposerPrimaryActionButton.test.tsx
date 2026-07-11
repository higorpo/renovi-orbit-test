// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposerPrimaryActionButton } from "../ChatComposerPrimaryActionButton";

describe("ChatComposerPrimaryActionButton", () => {
  it("sends on click in send mode and prevents mousedown default", () => {
    const onSend = vi.fn();
    const onRecordAudio = vi.fn();

    render(
      <ChatComposerPrimaryActionButton
        mode="send"
        disabled={false}
        onSend={onSend}
        onRecordAudio={onRecordAudio}
      />,
    );

    const button = screen.getByRole("button", { name: "Enviar mensagem" });
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onRecordAudio).not.toHaveBeenCalled();
  });

  it("starts audio recording in audio mode", () => {
    const onSend = vi.fn();
    const onRecordAudio = vi.fn();

    render(
      <ChatComposerPrimaryActionButton
        mode="audio"
        disabled={false}
        onSend={onSend}
        onRecordAudio={onRecordAudio}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));
    expect(onRecordAudio).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not fire actions when disabled", () => {
    const onSend = vi.fn();

    render(
      <ChatComposerPrimaryActionButton
        mode="send"
        disabled
        onSend={onSend}
        onRecordAudio={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
