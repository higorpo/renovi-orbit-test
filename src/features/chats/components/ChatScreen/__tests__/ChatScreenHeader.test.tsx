// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatScreenHeader } from "../ChatScreenHeader";

describe("ChatScreenHeader", () => {
  it("renders mobile layout and triggers back/details actions", () => {
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
    fireEvent.click(within(mobile).getByRole("button", { name: "Detalhes" }));

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
});
