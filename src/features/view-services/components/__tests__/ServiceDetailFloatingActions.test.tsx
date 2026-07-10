// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceDetailFloatingActions } from "../ServiceDetailFloatingActions";

describe("ServiceDetailFloatingActions", () => {
  it("shows start negotiation labels when chat does not exist", () => {
    const onOpenChat = vi.fn();
    render(
      <ServiceDetailFloatingActions hasExistingChat={false} onOpenChat={onOpenChat} />,
    );

    expect(screen.getByText("Iniciar negociação >")).toBeInTheDocument();
    expect(screen.getByText("Iniciar negociação com o cliente")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Iniciar negociação com o cliente" })[0]);
    expect(onOpenChat).toHaveBeenCalled();
  });

  it("shows view negotiation labels when chat exists", () => {
    render(
      <ServiceDetailFloatingActions
        hasExistingChat
        isInsideSheet
        isOpeningChat
        onOpenChat={vi.fn()}
      />,
    );

    expect(screen.getByText("Ver negociação >")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Visualizar negociação com o cliente" })[0],
    ).toBeDisabled();
  });
});
