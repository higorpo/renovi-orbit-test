// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatAudioRecordingSheet } from "../ChatAudioRecordingSheet";

const recorderState = vi.hoisted(() => ({
  isRecording: true,
  hasPendingRecording: false,
  isBusy: false,
  hitMaxDuration: false,
  elapsedMs: 5_000,
  remainingMs: 115_000,
  amplitude: 0.4,
  startRecording: vi.fn(async () => undefined),
  cancelRecording: vi.fn(async () => undefined),
  stopRecording: vi.fn(async () => ({
    file: new File(["audio"], "voice.webm", { type: "audio/webm" }),
    durationMs: 5_000,
  })),
}));

const useBreakpointMdMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => useBreakpointMdMock(),
}));

vi.mock("../../../hooks/useChatAudioRecorder", () => ({
  useChatAudioRecorder: () => recorderState,
}));

describe("ChatAudioRecordingSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBreakpointMdMock.mockReturnValue(true);
    Object.assign(recorderState, {
      isRecording: true,
      hasPendingRecording: false,
      isBusy: false,
      hitMaxDuration: false,
      elapsedMs: 5_000,
      remainingMs: 115_000,
      amplitude: 0.4,
    });
  });

  it("starts recording when opened on desktop and sends the clip", async () => {
    const onOpenChange = vi.fn();
    const onSend = vi.fn(async () => undefined);

    render(
      <ChatAudioRecordingSheet open onOpenChange={onOpenChange} onSend={onSend} />,
    );

    expect(recorderState.startRecording).toHaveBeenCalled();
    expect(screen.getByText("Gravar áudio")).toBeTruthy();
    expect(screen.getByText("0:05")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(recorderState.stopRecording).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSend).toHaveBeenCalledWith({
        file: expect.any(File),
        durationMs: 5_000,
      });
    });
  });

  it("cancels recording when the sheet is dismissed", () => {
    const onOpenChange = vi.fn();

    render(
      <ChatAudioRecordingSheet open onOpenChange={onOpenChange} onSend={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(recorderState.cancelRecording).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables send until the minimum duration is reached", () => {
    recorderState.elapsedMs = 500;

    render(
      <ChatAudioRecordingSheet open onOpenChange={vi.fn()} onSend={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("keeps the sheet open when stopRecording returns null", async () => {
    recorderState.stopRecording.mockResolvedValueOnce(null);
    const onOpenChange = vi.fn();
    const onSend = vi.fn();

    render(
      <ChatAudioRecordingSheet open onOpenChange={onOpenChange} onSend={onSend} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(recorderState.stopRecording).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows busy send label while uploading", () => {
    recorderState.isBusy = true;

    render(
      <ChatAudioRecordingSheet open onOpenChange={vi.fn()} onSend={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Enviando/i })).toBeDisabled();
  });

  it("cancels recording when the sheet closes", async () => {
    const { rerender } = render(
      <ChatAudioRecordingSheet open onOpenChange={vi.fn()} onSend={vi.fn()} />,
    );

    expect(recorderState.startRecording).toHaveBeenCalled();

    rerender(
      <ChatAudioRecordingSheet open={false} onOpenChange={vi.fn()} onSend={vi.fn()} />,
    );

    await waitFor(() => expect(recorderState.cancelRecording).toHaveBeenCalled());
  });

  it("renders the mobile drawer when below the md breakpoint", () => {
    useBreakpointMdMock.mockReturnValue(false);
    recorderState.hasPendingRecording = true;
    recorderState.isRecording = false;
    recorderState.hitMaxDuration = true;

    render(
      <ChatAudioRecordingSheet open onOpenChange={vi.fn()} onSend={vi.fn()} />,
    );

    expect(screen.getByText("Áudio pronto")).toBeTruthy();
    expect(screen.getByText(/Limite de 2:00 atingido/)).toBeTruthy();
  });
});
