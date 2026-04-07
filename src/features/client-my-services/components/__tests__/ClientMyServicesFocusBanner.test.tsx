import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientMyServicesFocusBanner } from "../ClientMyServicesFocusBanner";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";

const baseModel: ServiceRequestCardModel = {
  id: "sr-1",
  title: "Pedido especial",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  status: "open",
  statusTabId: "waiting_proposals",
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: null,
  service: null,
  photoPaths: [],
};

describe("ClientMyServicesFocusBanner", () => {
  it("renders nothing when there is no focus id", () => {
    const { container } = render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId={null}
        focusedRequest={null}
        isLoading={false}
        onClearFocus={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows loading copy while the focused request is loading", () => {
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-1"
        focusedRequest={null}
        isLoading
        onClearFocus={vi.fn()}
      />
    );
    expect(screen.getByText(/Carregando o pedido selecionado/i)).toBeInTheDocument();
  });

  it("shows focused request title when found", () => {
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-1"
        focusedRequest={baseModel}
        isLoading={false}
        onClearFocus={vi.fn()}
      />
    );
    expect(screen.getByText(/Pedido especial/i)).toBeInTheDocument();
  });

  it("shows not-found copy when focus id is set but request is missing", () => {
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-missing"
        focusedRequest={null}
        isLoading={false}
        onClearFocus={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Não encontramos esse pedido na sua lista/i)
    ).toBeInTheDocument();
  });

  it("calls onClearFocus when clearing the filter", () => {
    const onClearFocus = vi.fn();
    render(
      <ClientMyServicesFocusBanner
        focusServiceRequestId="sr-1"
        focusedRequest={baseModel}
        isLoading={false}
        onClearFocus={onClearFocus}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os serviços/i }));
    expect(onClearFocus).toHaveBeenCalledTimes(1);
  });
});
