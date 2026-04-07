import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FormBlock } from "../../../types";
import { ConditionalAlertBlock } from "../ConditionalAlertBlock";

function alertBlock(overrides: Partial<FormBlock> = {}): FormBlock {
  return {
    id: "a1",
    type: "conditional_alert",
    label: "Alert body",
    description_ai: "d",
    ...overrides,
  };
}

describe("ConditionalAlertBlock", () => {
  it("renders info variant by default", () => {
    render(<ConditionalAlertBlock block={alertBlock()} />);
    expect(screen.getByText("Alert body")).toBeInTheDocument();
  });

  it("renders warning variant", () => {
    render(
      <ConditionalAlertBlock
        block={alertBlock({ config: { alertType: "warning", alertTitle: "Cuidado" } })}
      />
    );
    expect(screen.getByText("Cuidado")).toBeInTheDocument();
    expect(screen.getByText("Alert body")).toBeInTheDocument();
  });

  it("renders success variant", () => {
    render(
      <ConditionalAlertBlock
        block={alertBlock({ config: { alertType: "success" }, helpText: "Extra help" })}
      />
    );
    expect(screen.getByText("Extra help")).toBeInTheDocument();
  });

  it("does not render title paragraph when alertTitle is empty", () => {
    const { container } = render(
      <ConditionalAlertBlock block={alertBlock({ config: { alertTitle: "" } })} />
    );
    expect(container.querySelectorAll("p.font-medium")).toHaveLength(0);
    expect(screen.getByText("Alert body")).toBeInTheDocument();
  });

  it("falls back to info for unknown alertType", () => {
    render(
      <ConditionalAlertBlock
        block={alertBlock({ config: { alertType: "unknown_kind" } })}
      />
    );
    expect(screen.getByText("Alert body")).toBeInTheDocument();
  });
});
