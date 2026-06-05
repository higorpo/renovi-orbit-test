import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ServiceModel } from "@/features/view-services";
import { ClientMyServicesFocusBanner } from "../ClientMyServicesFocusBanner";

const baseModel: ServiceModel = {
  id: "sr-1",
  title: "Pedido especial",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: null,
  service: null,
  photoPaths: [],
  proposalCount: 0,
  hasPendingProposal: false,
  counterpartyName: null,
  counterparty: null,
  contracted: null,
  tags: null,
  urgency: null,
  scopeComplexity: null,
  estimatedDurationHint: null,
  missingInfoWarnings: null,
};

describe("ClientMyServicesFocusBanner", () => {
  it("renders nothing when there is no focus id", () => {
    const { container } = render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId={null}
        focusedRequest={null}
        isLoading={false}
        onClearFocus={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows focused request title when found", () => {
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-1"
        focusedRequest={baseModel}
        isLoading={false}
        onClearFocus={vi.fn()}
      />,
    );
    expect(screen.getByText(/Pedido especial/i)).toBeInTheDocument();
  });

  it("calls onClearFocus when clearing the filter", () => {
    const onClearFocus = vi.fn();
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-1"
        focusedRequest={baseModel}
        isLoading={false}
        onClearFocus={onClearFocus}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os serviços/i }));
    expect(onClearFocus).toHaveBeenCalledTimes(1);
  });
});
