// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { ChatImageMessage } from "../ChatImageMessage";

vi.mock("../../../hooks/useChatImageDisplay", () => ({
  useChatImageDisplay: vi.fn(),
}));

import { useChatImageDisplay } from "../../../hooks/useChatImageDisplay";

const useChatImageDisplayMock = vi.mocked(useChatImageDisplay);

const baseMessage: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u1",
  message_type: "IMAGE",
  payload: { paths: ["chat/s/a.png"], preview: "Foto" },
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ChatImageMessage", () => {
  it("renders image when signed URLs are available", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/signed.png"],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing={false} />);

    const img = screen.getByRole("img", { name: "Imagem enviada no chat" });
    expect(img).toHaveAttribute("src", "https://example.com/signed.png");
    expect(screen.getByRole("button", { name: "Ampliar imagem 1 de 1" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens lightbox instead of navigating away", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/signed.png"],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing />);

    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem 1 de 1" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Imagem ampliada do chat" })).toHaveAttribute(
      "src",
      "https://example.com/signed.png",
    );
  });

  it("renders caption below images when provided", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/signed.png"],
      caption: "Detalhe do serviço",
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing />);

    expect(screen.getByText("Detalhe do serviço")).toBeTruthy();
  });
});
