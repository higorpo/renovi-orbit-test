// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatScreenHeader } from "../ChatScreenHeader";

describe("ChatScreenHeader", () => {
  it("renders identity and triggers back/details actions", () => {
    const onBack = vi.fn();
    const onDetails = vi.fn();

    render(
      <ChatScreenHeader
        counterpartyName="Maria Santos"
        serviceTitle="Pintura da sala"
        onBack={onBack}
        onDetails={onDetails}
      />,
    );

    expect(screen.getByText("Maria Santos")).toBeTruthy();
    expect(screen.getByText("Pintura da sala")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Voltar"));
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onDetails).toHaveBeenCalledTimes(1);
  });
});
