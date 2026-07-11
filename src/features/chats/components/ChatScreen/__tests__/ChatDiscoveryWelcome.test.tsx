// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatDiscoveryWelcome } from "../ChatDiscoveryWelcome";

describe("ChatDiscoveryWelcome", () => {
  it("shows client-oriented welcome copy", () => {
    render(<ChatDiscoveryWelcome viewerRole="client" />);

    expect(
      screen.getByRole("region", { name: "Negocie com o prestador" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tirar dúvidas, combinar detalhes do serviço/i),
    ).toBeInTheDocument();
  });

  it("shows provider-oriented welcome copy", () => {
    render(<ChatDiscoveryWelcome viewerRole="provider" />);

    expect(
      screen.getByRole("region", { name: "Comece a negociação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Apresente-se, tire dúvidas sobre o pedido/i),
    ).toBeInTheDocument();
  });
});
