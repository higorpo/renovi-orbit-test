// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { ChatAudioMessage } from "../ChatAudioMessage";

const playbackState = vi.hoisted(() => ({
  isLoading: false,
  isPlaying: false,
  hasError: false,
  amplitudeReady: true,
  currentTimeMs: 5_000,
  totalDurationMs: 30_000,
  playbackRate: 1,
  togglePlay: vi.fn(),
  seekToMs: vi.fn(),
  cycleSpeed: vi.fn(),
}));

vi.mock("../../../hooks/useChatAudioPlayback", () => ({
  useChatAudioPlayback: () => playbackState,
}));

const baseMessage: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u1",
  message_type: "AUDIO",
  payload: { path: "chat/s/a.webm", duration_ms: 30_000 },
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ChatAudioMessage", () => {
  it("renders duration and play controls for a ready clip", () => {
    Object.assign(playbackState, {
      isLoading: false,
      isPlaying: false,
      hasError: false,
      amplitudeReady: true,
      currentTimeMs: 5_000,
      totalDurationMs: 30_000,
      playbackRate: 1,
    });

    render(<ChatAudioMessage message={baseMessage} isOutgoing={false} />);

    expect(screen.getByText("0:05 / 0:30")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Posição do áudio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1x" })).toBeTruthy();
  });

  it("toggles playback and seeks when the user interacts", () => {
    Object.assign(playbackState, {
      isLoading: false,
      isPlaying: false,
      hasError: false,
      amplitudeReady: true,
      currentTimeMs: 0,
      totalDurationMs: 20_000,
      playbackRate: 1.25,
    });

    render(<ChatAudioMessage message={baseMessage} isOutgoing />);

    fireEvent.click(screen.getByRole("button", { name: "Reproduzir áudio" }));
    expect(playbackState.togglePlay).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole("slider", { name: "Posição do áudio" }), {
      target: { value: "8000" },
    });
    expect(playbackState.seekToMs).toHaveBeenCalledWith(8000);

    fireEvent.click(screen.getByRole("button", { name: "1.25x" }));
    expect(playbackState.cycleSpeed).toHaveBeenCalledOnce();
  });

  it("shows an error message when playback fails to load", () => {
    Object.assign(playbackState, {
      isLoading: false,
      isPlaying: false,
      hasError: true,
      amplitudeReady: true,
      currentTimeMs: 0,
      totalDurationMs: 0,
      playbackRate: 1,
    });

    render(<ChatAudioMessage message={baseMessage} isOutgoing={false} />);

    expect(screen.getByText("Não foi possível carregar o áudio.")).toBeTruthy();
  });

  it("disables play while the clip is still loading", () => {
    Object.assign(playbackState, {
      isLoading: true,
      isPlaying: false,
      hasError: false,
      amplitudeReady: false,
      currentTimeMs: 0,
      totalDurationMs: 0,
      playbackRate: 1,
    });

    render(<ChatAudioMessage message={baseMessage} isOutgoing={false} />);

    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeDisabled();
  });
});
