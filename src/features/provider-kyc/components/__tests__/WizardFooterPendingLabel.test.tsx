import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardFooterPendingLabel } from "../ProviderKycWizardStepContent";

describe("WizardFooterPendingLabel", () => {
  it("renders sending feedback for the submit button", () => {
    render(
      <button type="button">
        <WizardFooterPendingLabel />
      </button>,
    );
    expect(screen.getByText(/Enviando/i)).toBeInTheDocument();
  });
});
