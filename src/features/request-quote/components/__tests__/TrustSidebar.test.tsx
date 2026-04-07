import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustSidebar } from "../TrustSidebar";

describe("TrustSidebar", () => {
  it("renders trust content for default desktop variant", () => {
    render(<TrustSidebar />);
    expect(screen.getByText("Por que usar a Renovi?")).toBeInTheDocument();
    expect(screen.getByText("Profissionais verificados")).toBeInTheDocument();
    expect(screen.getByText("Pagamento protegido")).toBeInTheDocument();
    expect(screen.getByText("Satisfação garantida")).toBeInTheDocument();
    expect(screen.getByText("Atendimento humano")).toBeInTheDocument();
    expect(screen.getByText(/O que dizem nossos clientes/)).toBeInTheDocument();
    expect(screen.getByText(/98% de satisfação/)).toBeInTheDocument();
  });

  it("renders mobile variant with same sections", () => {
    const { container } = render(<TrustSidebar variant="mobile" />);
    expect(screen.getByText("Por que usar a Renovi?")).toBeInTheDocument();
    expect(container.querySelector(".space-y-4")).toBeInTheDocument();
  });
});
