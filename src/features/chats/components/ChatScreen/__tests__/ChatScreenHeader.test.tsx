// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatScreenHeader } from "../ChatScreenHeader";

const { useOnlineStatusMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

describe("ChatScreenHeader", () => {
  it("uses compact top inset on mobile when offline", () => {
    useOnlineStatusMock.mockReturnValue(false);
    render(
      <ChatScreenHeader
        counterpartyName="Maria Santos"
        serviceTitle="Pintura da sala"
        onBack={vi.fn()}
      />,
    );

    const mobile = screen.getByTestId("chat-header-mobile");
    expect(mobile.className).toContain("pt-3");
    expect(mobile.className).not.toContain("safe-area-inset-top");
  });

  it("renders mobile layout and triggers back/details actions", () => {
    useOnlineStatusMock.mockReturnValue(true);
    const onBack = vi.fn();
    const onDetails = vi.fn();

    render(
      <ChatScreenHeader
        counterpartyName="Maria Santos"
        serviceTitle="Pintura da sala"
        conversationStatus="INACTIVE"
        onBack={onBack}
        onDetails={onDetails}
      />,
    );

    const mobile = screen.getByTestId("chat-header-mobile");
    expect(within(mobile).getByText("Maria Santos")).toBeTruthy();
    expect(within(mobile).getByText("Pintura da sala")).toBeTruthy();
    expect(within(mobile).getByText("Inativa")).toBeTruthy();

    fireEvent.click(within(mobile).getByLabelText("Voltar"));
    const detailsButton = within(mobile).getByRole("button", { name: "Detalhes" });
    expect(detailsButton.className).toContain("absolute");
    fireEvent.click(detailsButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("renders desktop layout with identity left and actions right", () => {
    const onDetails = vi.fn();

    render(
      <ChatScreenHeader
        counterpartyName="Maria Santos"
        serviceTitle="Pintura da sala"
        conversationStatus="CLOSED"
        onBack={vi.fn()}
        onDetails={onDetails}
      />,
    );

    const desktop = screen.getByTestId("chat-header-desktop");
    expect(desktop).toHaveClass("md:flex");
    expect(within(desktop).getByText("Maria Santos")).toBeTruthy();
    expect(within(desktop).getByText("Pintura da sala")).toBeTruthy();
    expect(within(desktop).getByText("Encerrada")).toBeTruthy();
    expect(within(desktop).queryByLabelText("Voltar")).toBeNull();

    fireEvent.click(within(desktop).getByRole("button", { name: "Detalhes" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("does not show status badge for ACTIVE conversations", () => {
    render(
      <ChatScreenHeader
        counterpartyName="Maria Santos"
        serviceTitle="Pintura da sala"
        conversationStatus="ACTIVE"
        onBack={vi.fn()}
        onDetails={vi.fn()}
      />,
    );

    expect(screen.queryByText("Ativa")).toBeNull();
  });

  it("truncates long counterparty and service titles in desktop layout", () => {
    const longName = "Maria Santos da Silva Oliveira Carvalho Mendes";
    const longTitle =
      "Pintura completa da sala de estar, corredor e área gourmet com preparação de superfície";

    render(
      <ChatScreenHeader
        counterpartyName={longName}
        serviceTitle={longTitle}
        conversationStatus="ACTIVE"
        onBack={vi.fn()}
        onDetails={vi.fn()}
      />,
    );

    const desktop = screen.getByTestId("chat-header-desktop");
    const name = within(desktop).getByRole("heading", { level: 1 });
    const service = within(desktop).getByText(longTitle);

    expect(name).toHaveClass("truncate");
    expect(service).toHaveClass("truncate");
    expect(desktop.querySelector(".flex-1.overflow-hidden")).toBeTruthy();
  });
});
