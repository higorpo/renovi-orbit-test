import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KycWizardStepper } from "../KycWizardStepper";

describe("KycWizardStepper", () => {
  it("renders one segment per step and exposes progress semantics", () => {
    const { container, getByRole } = render(
      <KycWizardStepper currentStep={2} totalSteps={5} />,
    );

    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar).toHaveAccessibleName("Passo 2 de 5");

    const segments = container.querySelectorAll("[role='progressbar'] > div");
    expect(segments).toHaveLength(5);
    expect(segments[0]).toHaveClass("bg-primary");
    expect(segments[1]).toHaveClass("bg-primary");
    expect(segments[2]).toHaveClass("bg-muted");
  });
});
