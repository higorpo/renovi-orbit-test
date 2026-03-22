import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Wrench } from "lucide-react";
import { ServiceCard } from "../ServiceCard";
import type { ServiceRequestCardModel } from "../../types/service-request-view.types";

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: vi.fn(() => ({ urls: [], isLoading: false })),
  getServiceCardStyle: vi.fn(() => ({
    Icon: Wrench,
    color: "from-slate-500 to-slate-700",
  })),
}));

function makeModel(
  overrides: Partial<ServiceRequestCardModel> = {}
): ServiceRequestCardModel {
  return {
    id: "sr-1",
    title: "Troca de tomadas",
    description: "Preciso trocar tomadas na sala.",
    descriptionPreview: "Preciso trocar tomadas na sala.",
    status: "open",
    statusTabId: "waiting_proposals",
    createdAt: "2025-03-01T10:00:00Z",
    updatedAt: "2025-03-01T10:00:00Z",
    address: { neighborhood: "Trindade", cityName: "Florianópolis" },
    service: { title: "Eletricista", slug: "eletricista" },
    photoPaths: [],
    ...overrides,
  };
}

describe("ServiceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title, description preview, and location", () => {
    const model = makeModel();
    render(
      <MemoryRouter>
        <ServiceCard model={model} />
      </MemoryRouter>
    );
    const headings = screen.getAllByRole("heading", { level: 2, name: /Troca de tomadas/i });
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(headings[0]).toBeInTheDocument();
    expect(screen.getByText(/Preciso trocar tomadas na sala/i)).toBeInTheDocument();
    expect(screen.getByText(/Trindade, Florianópolis/)).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const model = makeModel();
    render(
      <MemoryRouter>
        <ServiceCard model={model} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Aguardando orçamentos/i)).toBeInTheDocument();
  });

  it("links card to service detail", () => {
    const model = makeModel();
    render(
      <MemoryRouter>
        <ServiceCard model={model} />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", {
      name: /Ver detalhes do serviço: Troca de tomadas/i,
    });
    expect(link).toHaveAttribute("href", "/dashboard/services/sr-1");
  });

  it("renders action buttons for open status", () => {
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(
      <MemoryRouter>
        <ServiceCard model={model} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /Editar serviço/i })).toBeInTheDocument();
    const verDetalhesLinks = screen.getAllByRole("link", { name: /Ver detalhes/i });
    expect(verDetalhesLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Cancelar serviço button when onCancel is passed and status is open", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(
      <MemoryRouter>
        <ServiceCard model={model} onCancel={onCancel} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /Cancelar serviço/i })).toBeInTheDocument();
  });

  it("opens confirm dialog and calls onCancel when user confirms cancel", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(
      <MemoryRouter>
        <ServiceCard model={model} onCancel={onCancel} />
      </MemoryRouter>
    );
    const cancelBtn = screen.getByRole("button", { name: /Cancelar serviço/i });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole("alertdialog", { name: /Cancelar serviço\?/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /^Cancelar$/i });
    fireEvent.click(confirmBtn);
    expect(onCancel).toHaveBeenCalledWith(model.id);
  });
});
