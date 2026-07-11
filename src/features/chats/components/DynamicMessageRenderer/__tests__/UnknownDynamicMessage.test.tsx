// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnknownDynamicMessage } from "../UnknownDynamicMessage";

describe("UnknownDynamicMessage", () => {
  it("renders preview text and message type", () => {
    render(
      <UnknownDynamicMessage messageType="FUTURE_TYPE" previewText="Conteúdo novo" />,
    );

    expect(screen.getByText("Mensagem não suportada")).toBeTruthy();
    expect(screen.getByText("Conteúdo novo")).toBeTruthy();
    expect(screen.getByText("Tipo: FUTURE_TYPE")).toBeTruthy();
  });

  it("falls back to default copy when preview is empty", () => {
    render(<UnknownDynamicMessage messageType="UNKNOWN" previewText="   " />);

    expect(
      screen.getByText(
        "Este tipo de mensagem ainda não pode ser exibido nesta versão do app.",
      ),
    ).toBeTruthy();
  });
});
