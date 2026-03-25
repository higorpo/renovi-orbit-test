import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientMyServicesSections } from "../ClientMyServicesSections";

vi.mock("../ClientMyServicesPhotoGallery", () => ({
  ClientMyServicesPhotoGallery: () => <div data-testid="mock-gallery" />,
}));

vi.mock("@/features/dynamic-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/dynamic-form")>();
  return {
    ...actual,
    buildSummaryEntries: vi.fn(() => [
      { id: "f1", label: "Campo", displayValue: "Valor" },
    ]),
  };
});

describe("ClientMyServicesSections", () => {
  it("renders description, summary entries, and photo gallery section", () => {
    render(
      <ClientMyServicesSections
        description="Preciso de pintura"
        formData={{}}
        formSchema={null}
        photos={["p1"]}
      />
    );

    expect(screen.getByText("Preciso de pintura")).toBeInTheDocument();
    expect(screen.getByText("Campo")).toBeInTheDocument();
    expect(screen.getByText("Valor")).toBeInTheDocument();
    expect(screen.getByText(/Fotos \(1\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("mock-gallery")).toBeInTheDocument();
  });

  it("omits description block when empty", () => {
    render(
      <ClientMyServicesSections
        description={null}
        formData={{}}
        formSchema={null}
        photos={[]}
      />
    );
    expect(screen.queryByRole("heading", { name: /Descrição/i })).not.toBeInTheDocument();
  });
});
