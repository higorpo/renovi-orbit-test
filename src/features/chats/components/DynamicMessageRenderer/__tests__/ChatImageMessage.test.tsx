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

  it("shows unavailable copy when there are no image paths", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: [],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 0,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing={false} />);
    expect(screen.getByText("Imagem indisponível")).toBeTruthy();
  });

  it("shows a loading placeholder while signed urls resolve", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: [],
      caption: null,
      isLoading: true,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing />);
    expect(screen.getByLabelText("Carregando imagem")).toHaveAttribute("aria-busy", "true");
  });

  it("shows an error state when signed urls fail", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: [],
      caption: null,
      isLoading: false,
      hasError: true,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing={false} />);
    expect(screen.getByText("Não foi possível carregar a imagem")).toBeTruthy();
  });

  it("renders a two-column grid for multiple images", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/a.png", "https://example.com/b.png"],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 2,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing />);

    expect(screen.getByRole("button", { name: "Ampliar imagem 1 de 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ampliar imagem 2 de 2" })).toBeTruthy();
  });

  it("closes the lightbox when Fechar is clicked", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Fechar imagem ampliada" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses caption in enlarge aria-label when present", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/signed.png"],
      caption: "Detalhe",
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing={false} />);
    expect(screen.getByRole("button", { name: "Ampliar imagem: Detalhe" })).toBeTruthy();
  });

  it("shows error styling for incoming failed images", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: [],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    render(<ChatImageMessage message={baseMessage} isOutgoing={false} />);
    expect(screen.getByText("Não foi possível carregar a imagem")).toBeTruthy();
  });

  it("skips re-render when memoized props are unchanged", () => {
    useChatImageDisplayMock.mockReturnValue({
      urls: ["https://example.com/signed.png"],
      caption: null,
      isLoading: false,
      hasError: false,
      pathCount: 1,
    });

    const { rerender } = render(
      <ChatImageMessage message={baseMessage} isOutgoing groupPosition="single" className="x" />,
    );
    const callsAfterFirst = useChatImageDisplayMock.mock.calls.length;

    rerender(
      <ChatImageMessage message={baseMessage} isOutgoing groupPosition="single" className="x" />,
    );
    expect(useChatImageDisplayMock.mock.calls.length).toBe(callsAfterFirst);

    rerender(
      <ChatImageMessage
        message={baseMessage}
        isOutgoing={false}
        groupPosition="single"
        className="x"
      />,
    );
    expect(useChatImageDisplayMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
