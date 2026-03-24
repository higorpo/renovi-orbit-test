import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  overrides: Partial<ServiceRequestCardModel> = {}
): ServiceRequestCardModel {
  return {
    id: "sr-1",
    title: "Troca de tomadas",
    description: "Preciso trocar tomadas na sala.",
    descriptionPreview: "Preciso trocar tomadas na sala.",
    formData: null,
    formSchema: null,
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

describe("ClientMyServicesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title, description preview, and location", () => {
    const model = makeModel();
    render(<ClientMyServicesCard model={model} />);
    const headings = screen.getAllByRole("heading", { level: 2, name: /Troca de tomadas/i });
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(headings[0]).toBeInTheDocument();
    expect(screen.getByText(/Preciso trocar tomadas na sala/i)).toBeInTheDocument();
    expect(screen.getByText(/Trindade, Florianópolis/)).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const model = makeModel();
    render(<ClientMyServicesCard model={model} />);
    expect(screen.getByText(/Aguardando orçamentos/i)).toBeInTheDocument();
  });

  it("renders 'Aguardando decisão' when open has submitted proposal", () => {
    const model = makeModel({
      status: "open",
      hasSubmittedProposal: true,
    });
    render(<ClientMyServicesCard model={model} />);
    expect(screen.getByText(/Aguardando decisão/i)).toBeInTheDocument();
  });

  it("calls onOpenDetails when details button is clicked", () => {
    const model = makeModel();
    const onOpenDetails = vi.fn();
    render(<ClientMyServicesCard model={model} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    expect(onOpenDetails).toHaveBeenCalledWith(model);
  });

  it("renders action buttons for open status", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "waiting_proposals",
      proposalCount: 2,
    });
    render(<ClientMyServicesCard model={model} />);
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver orçamentos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver perguntas/i })).toBeInTheDocument();
  });

  it("does not render budgets action when open has no proposals", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "waiting_proposals",
      proposalCount: 0,
    });
    render(<ClientMyServicesCard model={model} />);

    expect(screen.queryByRole("button", { name: /Ver orçamentos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver perguntas/i })).toBeInTheDocument();
  });

  it("does not render budgets/questions actions when open has exactly one proposal", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "negotiation",
      proposalCount: 1,
    });
    render(<ClientMyServicesCard model={model} />);

    expect(screen.queryByRole("button", { name: /Ver orçamentos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver perguntas/i })).not.toBeInTheDocument();
  });

  it("calls callbacks when budgets/questions actions are clicked", () => {
    const onOpenBudgets = vi.fn();
    const onOpenQuestions = vi.fn();
    const model = makeModel({ status: "open", proposalCount: 2 });
    render(
      <ClientMyServicesCard
        model={model}
        onOpenBudgets={onOpenBudgets}
        onOpenQuestions={onOpenQuestions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Ver orçamentos/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ver perguntas/i }));

    expect(onOpenBudgets).toHaveBeenCalledWith(model.id);
    expect(onOpenQuestions).toHaveBeenCalledWith(model.id);
  });

  it("renders Cancelar serviço button when onCancel is passed and status is open", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(<ClientMyServicesCard model={model} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /Cancelar serviço/i })).toBeInTheDocument();
  });

  it("opens confirm dialog and calls onCancel when user confirms cancel", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(<ClientMyServicesCard model={model} onCancel={onCancel} />);
    const cancelBtn = screen.getByRole("button", { name: /Cancelar serviço/i });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole("alertdialog", { name: /Cancelar serviço\?/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /^Cancelar$/i });
    fireEvent.click(confirmBtn);
    expect(onCancel).toHaveBeenCalledWith(model.id);
  });
});
