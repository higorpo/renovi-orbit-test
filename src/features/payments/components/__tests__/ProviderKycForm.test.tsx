// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderKycForm } from "../ProviderKycForm";

vi.mock("../../hooks/useDispatchKyc", () => ({
  useDispatchKyc: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../../api/kyc.api", () => ({
  uploadKycDocument: vi.fn(),
}));

describe("ProviderKycForm", () => {
  it("hides CNPJ-only fields when entity type is CPF", () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    expect(screen.queryByTestId("kyc-cnpj-fields")).toBeNull();
    expect(screen.queryByLabelText("Razão social")).toBeNull();
  });

  it("shows CNPJ-only fields when entity type is CNPJ", () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica \(CNPJ\)/i }));

    expect(screen.getByTestId("kyc-cnpj-fields")).toBeInTheDocument();
    expect(screen.getByLabelText("Razão social")).toBeInTheDocument();
  });
});
