// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceDetailFloatingActions } from "../ServiceDetailFloatingActions";

describe("ServiceDetailFloatingActions", () => {
  it("shows start negotiation mobile FAB when chat does not exist", () => {
    const onOpenChat = vi.fn();
    render(
      <ServiceDetailFloatingActions hasExistingChat={false} onOpenChat={onOpenChat} />,
    );

    expect(screen.getByText("Iniciar negociação >")).toBeInTheDocument();
    expect(screen.queryByText("Iniciar negociação com o cliente")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar negociação com o cliente" }));
    expect(onOpenChat).toHaveBeenCalled();
  });

  it("shows view negotiation mobile FAB when chat exists", () => {
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
      screen.getByRole("button", { name: "Visualizar negociação com o cliente" }),
    ).toBeDisabled();
  });
});
