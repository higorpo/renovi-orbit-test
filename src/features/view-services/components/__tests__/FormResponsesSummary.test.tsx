// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormResponsesSummary } from "../FormResponsesSummary";

vi.mock("@/features/dynamic-form", () => ({
  buildSummaryEntries: (formData: Record<string, unknown> | null) => {
    if (!formData) return [];
    return Object.entries(formData).map(([id, value]) => ({
      id,
      label: id === "descricao" ? "Descreva o que precisa" : id,
      displayValue: String(value),
      type: id === "descricao" ? "description_ai" : id === "urgency" ? "urgency" : "text",
      rawValue: value,
    }));
  },
}));

describe("FormResponsesSummary", () => {
  it("returns null when there are no entries", () => {
    const { container } = render(
      <FormResponsesSummary formData={null} formSchema={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders labeled form answers with icons", () => {
    render(
      <FormResponsesSummary
        formData={{ urgency: "Alta", descricao: "Texto longo do pedido" }}
        formSchema={null}
      />,
    );
    expect(screen.getByText("Informações do pedido")).toBeInTheDocument();
    expect(screen.getByText("urgency")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("Descreva o que precisa")).toBeInTheDocument();
    expect(screen.getByText("Texto longo do pedido")).toBeInTheDocument();
  });
});
