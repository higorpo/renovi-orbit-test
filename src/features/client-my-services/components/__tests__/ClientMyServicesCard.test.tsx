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
    address: { neighborhood: "Trindade", cityName: "Florian\u00f3polis" },
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
    expect(screen.getByText(/Trindade, Florian\u00f3polis/)).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const model = makeModel();
    render(<ClientMyServicesCard model={model} />);
    expect(screen.getByText(/Aguardando or\u00e7amentos/i)).toBeInTheDocument();
  });

  it("renders 'Aguardando decis\u00e3o' when open has submitted proposal", () => {
    const model = makeModel({
      status: "open",
      hasSubmittedProposal: true,
    });
    render(<ClientMyServicesCard model={model} />);
    expect(screen.getByText(/Aguardando decis\u00e3o/i)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Ver or\u00e7amentos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver perguntas/i })).toBeInTheDocument();
  });

  it("does not render budgets action when open has no proposals", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "waiting_proposals",
      proposalCount: 0,
    });
    render(<ClientMyServicesCard model={model} />);

    expect(screen.queryByRole("button", { name: /Ver or\u00e7amentos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver perguntas/i })).toBeInTheDocument();
  });

  it("does not render budgets/questions actions when open has exactly one proposal", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "negotiation",
      proposalCount: 1,
    });
    render(<ClientMyServicesCard model={model} />);

    expect(screen.queryByRole("button", { name: /Ver or\u00e7amentos/i })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /Ver or\u00e7amentos/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ver perguntas/i }));

    expect(onOpenBudgets).toHaveBeenCalledWith(model.id);
    expect(onOpenQuestions).toHaveBeenCalledWith(model.id);
  });

  it("renders Cancelar servi\u00e7o button when onCancel is passed and status is open", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(<ClientMyServicesCard model={model} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /Cancelar servi\u00e7o/i })).toBeInTheDocument();
  });

  it("opens confirm dialog and calls onCancel when user confirms cancel", () => {
    const onCancel = vi.fn();
    const model = makeModel({ status: "open", statusTabId: "waiting_proposals" });
    render(<ClientMyServicesCard model={model} onCancel={onCancel} />);
    const cancelBtn = screen.getByRole("button", { name: /Cancelar servi\u00e7o/i });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole("alertdialog", { name: /Cancelar servi\u00e7o\?/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /^Cancelar$/i });
    fireEvent.click(confirmBtn);
    expect(onCancel).toHaveBeenCalledWith(model.id);
  });

  it("shows professional and progress for in_progress status", () => {
    const model = makeModel({
      status: "in_progress",
      selectedProfessionalName: "Jo\u00e3o",
      progressPercent: 50,
    });
    const { container } = render(<ClientMyServicesCard model={model} />);
    expect(container.textContent).toContain("Profissional:");
    expect(container.textContent).toContain("Jo\u00e3o");
    expect(screen.getByText(/Progresso: 50%/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();
  });

  it("shows Ver detalhes for closed and cancelled without extra actions", () => {
    const closed = makeModel({ status: "closed", statusTabId: "completed" });
    const { unmount } = render(<ClientMyServicesCard model={closed} />);
    expect(screen.getAllByRole("button", { name: /Ver detalhes/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Cancelar/i })).not.toBeInTheDocument();
    unmount();

    const cancelled = makeModel({ status: "cancelled", statusTabId: "cancelled" });
    render(<ClientMyServicesCard model={cancelled} />);
    expect(screen.getAllByRole("button", { name: /Ver detalhes/i }).length).toBeGreaterThan(0);
  });

  it("falls back to default actions for unknown status", () => {
    const model = makeModel({
      status: "open",
      statusTabId: "waiting_proposals",
    });
    const unknown = {
      ...model,
      status: "unknown" as unknown as ServiceRequestCardModel["status"],
    };
    render(<ClientMyServicesCard model={unknown} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();
  });
});
