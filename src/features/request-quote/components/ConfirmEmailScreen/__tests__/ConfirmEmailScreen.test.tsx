import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ConfirmEmailScreen } from "../ConfirmEmailScreen";

describe("ConfirmEmailScreen", () => {
  it("shows success title, email and link to login", () => {
    render(
      <MemoryRouter>
        <ConfirmEmailScreen email="user@example.com" />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Pedido de orçamento enviado com sucesso/i })
    ).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    const loginLink = screen.getByRole("link", { name: /Ir para o login/i });
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(
      screen.getByText(/confirmar seu e-mail para que profissionais possam ver/i)
    ).toBeInTheDocument();
  });
});
