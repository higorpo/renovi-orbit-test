import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { ClientMyServicesCard } from "../ClientMyServicesCard";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: vi.fn(() => ({ urls: [], isLoading: false })),
  getServiceCardStyle: vi.fn(() => ({
    Icon: Wrench,
    color: "from-slate-500 to-slate-700",
  })),
}));

function makeModel(
  overrides: Partial<ServiceRequestCardModel> = {},
): ServiceRequestCardModel {
  return {
    id: "sr-1",
    title: "Troca de tomadas",
    description: "Preciso trocar tomadas na sala.",
    descriptionPreview: "Preciso trocar tomadas na sala.",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    createdAt: "2025-03-01T10:00:00Z",
    updatedAt: "2025-03-01T10:00:00Z",
    address: { neighborhood: "Trindade", cityName: "Florianópolis" },
    service: { title: "Eletricista", slug: "eletricista" },
    photoPaths: [],
    ...overrides,
  };
}

describe("ClientMyServicesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title, description preview, and location", () => {
    render(<ClientMyServicesCard model={makeModel()} />);
    expect(screen.getAllByRole("heading", { level: 2, name: /Troca de tomadas/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Preciso trocar tomadas na sala/i)).toBeInTheDocument();
    expect(screen.getByText(/Trindade, Florianópolis/)).toBeInTheDocument();
  });

  it("renders negotiation status badge", () => {
    render(<ClientMyServicesCard model={makeModel()} />);
    expect(screen.getByText(/Em negociação/i)).toBeInTheDocument();
  });

  it("renders Aguardando decisão when negotiation has pending proposal", () => {
    render(
      <ClientMyServicesCard
        model={makeModel({ hasPendingClientProposal: true })}
      />,
    );
    expect(screen.getByText(/Aguardando decisão/i)).toBeInTheDocument();
  });

  it("renders insight tags from model metadata", () => {
    render(
      <ClientMyServicesCard
        model={makeModel({
          urgency: "high",
          tags: ["Tomada nova"],
        })}
      />,
    );
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.getByText("Tomada nova")).toBeInTheDocument();
  });

  it("calls onOpenDetails when details button is clicked", () => {
    const model = makeModel();
    const onOpenDetails = vi.fn();
    render(<ClientMyServicesCard model={model} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    expect(onOpenDetails).toHaveBeenCalledWith(model);
  });

  it("renders compare budgets action for negotiation with proposals", () => {
    render(
      <ClientMyServicesCard model={makeModel({ proposalCount: 2 })} />,
    );
    expect(screen.getByRole("button", { name: /Comparar orçamentos/i })).toBeInTheDocument();
  });

  it("renders history action for in_progress with proposals", () => {
    render(
      <ClientMyServicesCard
        model={makeModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          proposalCount: 1,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Histórico de orçamentos/i })).toBeInTheDocument();
  });

  it("calls onOpenBudgets with model when budgets action is clicked", () => {
    const onOpenBudgets = vi.fn();
    const model = makeModel({ proposalCount: 2 });
    render(
      <ClientMyServicesCard model={model} onOpenBudgets={onOpenBudgets} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Comparar orçamentos/i }));
    expect(onOpenBudgets).toHaveBeenCalledWith(model);
  });

  it("allows cancel only in negotiation phase", () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <ClientMyServicesCard model={makeModel()} onCancel={onCancel} />,
    );
    expect(screen.getByText("Cancelar pedido")).toBeInTheDocument();
    unmount();

    render(
      <ClientMyServicesCard
        model={makeModel({ listPhase: "in_progress", statusTabId: "in_progress" })}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByRole("button", { name: /Cancelar/i })).not.toBeInTheDocument();
  });

  it("shows professional for in_progress phase", () => {
    render(
      <ClientMyServicesCard
        model={makeModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          selectedProfessionalName: "João",
        })}
      />,
    );
    expect(screen.getByText(/Profissional: João/i)).toBeInTheDocument();
  });
});
