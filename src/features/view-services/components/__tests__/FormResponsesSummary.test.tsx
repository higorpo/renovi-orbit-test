// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormResponsesSummary } from "../FormResponsesSummary";

vi.mock("@/features/dynamic-form", () => ({
  buildSummaryEntries: (formData: Record<string, unknown> | null) => {
    if (!formData) return [];
    return Object.entries(formData).map(([id, value]) => ({
      id,
      label: id,
      displayValue: String(value),
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

  it("renders labeled form answers", () => {
    render(
      <FormResponsesSummary
        formData={{ rooms: 2 }}
        formSchema={null}
      />,
    );
    expect(screen.getByText("Informações do pedido")).toBeInTheDocument();
    expect(screen.getByText("rooms")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
