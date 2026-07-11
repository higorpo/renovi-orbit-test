import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FormBlock } from "../../../types";
import { ConditionalAlertBlock } from "../ConditionalAlertBlock";

function buildBlock(overrides: Partial<FormBlock> = {}): FormBlock {
  return {
    id: "alert-1",
    type: "conditional_alert",
    label: "Atenção ao prazo",
    description_ai: "Alert",
    ...overrides,
  };
}

describe("ConditionalAlertBlock", () => {
  it("renders info alert with title and help text", () => {
    render(
      <ConditionalAlertBlock
        block={buildBlock({
          helpText: "Mais detalhes",
          config: { alertType: "info", alertTitle: "Info" },
        })}
      />,
    );

    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Atenção ao prazo")).toBeInTheDocument();
    expect(screen.getByText("Mais detalhes")).toBeInTheDocument();
  });

  it("renders warning and success variants", () => {
    const { rerender } = render(
      <ConditionalAlertBlock
        block={buildBlock({
          label: "Cuidado",
          config: { alertType: "warning" },
        })}
      />,
    );
    expect(screen.getByText("Cuidado")).toBeInTheDocument();

    rerender(
      <ConditionalAlertBlock
        block={buildBlock({
          label: "Tudo certo",
          config: { alertType: "success" },
        })}
      />,
    );
    expect(screen.getByText("Tudo certo")).toBeInTheDocument();
  });

  it("falls back to info styles for unknown alert types", () => {
    const { container } = render(
      <ConditionalAlertBlock
        block={buildBlock({
          config: { alertType: "unknown" },
        })}
      />,
    );

    expect(container.firstChild).toHaveClass("bg-blue-500/10");
  });

  it("omits empty alert titles", () => {
    render(
      <ConditionalAlertBlock
        block={buildBlock({
          config: { alertTitle: "" },
        })}
      />,
    );

    expect(screen.queryByText("Info")).not.toBeInTheDocument();
    expect(screen.getByText("Atenção ao prazo")).toBeInTheDocument();
  });
});
