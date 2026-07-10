// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceSections } from "../ServiceSections";

vi.mock("@/features/dynamic-form", () => ({
  buildSummaryEntries: (formData: Record<string, unknown> | null) => {
    if (!formData) return [];
    return [{ id: "q1", label: "Pergunta", displayValue: "Resposta" }];
  },
}));

vi.mock("../ServicePhotoGallery", () => ({
  ServicePhotoGallery: () => <div data-testid="gallery" />,
}));

describe("ServiceSections", () => {
  it("renders description, form answers, and photos", () => {
    render(
      <ServiceSections
        description="Texto"
        formData={{ q1: true }}
        formSchema={null}
        photos={["a.jpg"]}
      />,
    );

    expect(screen.getByText("Descrição")).toBeInTheDocument();
    expect(screen.getByText("Texto")).toBeInTheDocument();
    expect(screen.getByText("Informações do pedido")).toBeInTheDocument();
    expect(screen.getByText("Pergunta")).toBeInTheDocument();
    expect(screen.getByText("Fotos (1)")).toBeInTheDocument();
  });

  it("omits empty sections", () => {
    render(
      <ServiceSections
        description={null}
        formData={null}
        formSchema={null}
        photos={[]}
      />,
    );
    expect(screen.queryByText("Descrição")).not.toBeInTheDocument();
    expect(screen.queryByText("Informações do pedido")).not.toBeInTheDocument();
  });
});
