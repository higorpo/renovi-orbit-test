import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PayoutMethodsSection } from "../PayoutMethodsSection";

describe("PayoutMethodsSection", () => {
  it("renders bank fields as read-only and points to support", () => {
    render(
      <PayoutMethodsSection
        bankLabel="Banco do Brasil (001)"
        bankBranch="1234"
        bankAccount="56789-0"
        pixKey="joao@prestway.com"
        supportHref="mailto:contato@prestway.com"
      />,
    );

    const bank = screen.getByLabelText("Banco");
    const branch = screen.getByLabelText("Agência");
    const account = screen.getByLabelText("Conta com dígito");
    const pix = screen.getByLabelText("Chave PIX");

    expect(bank).toHaveValue("Banco do Brasil (001)");
    expect(branch).toHaveValue("1234");
    expect(account).toHaveValue("56789-0");
    expect(pix).toHaveValue("joao@prestway.com");

    for (const field of [bank, branch, account, pix]) {
      expect(field).toBeDisabled();
      expect(field).toHaveAttribute("readonly");
    }

    expect(screen.getByText(/não podem ser alterados por aqui/i)).toBeInTheDocument();
    const support = screen.getByRole("link", { name: /Falar com o suporte/i });
    expect(support).toHaveAttribute("href", "mailto:contato@prestway.com");
  });

  it("shows placeholders when a field is empty", () => {
    render(
      <PayoutMethodsSection
        bankLabel={null}
        bankBranch={null}
        bankAccount={null}
        pixKey={null}
        supportHref="https://prestway.test/suporte"
      />,
    );

    expect(screen.getByLabelText("Banco")).toHaveValue("—");
    expect(screen.getByLabelText("Agência")).toHaveValue("—");
    expect(screen.getByLabelText("Conta com dígito")).toHaveValue("—");
    expect(screen.getByLabelText("Chave PIX")).toHaveValue("Não informada");
  });
});
