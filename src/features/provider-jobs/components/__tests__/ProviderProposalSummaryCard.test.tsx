import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderProposalHistoryItem } from "../../api/providerProposals.api";
import { ProviderProposalSummaryCard } from "../ProviderProposalSummaryCard";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const historyItem: ProviderProposalHistoryItem = {
  id: "hp1",
  proposed_amount: 99,
  proposal_description: "Hist\u00f3rico",
  proposal_duration_value: 1,
  proposal_duration_unit: "hours",
  proposal_suggested_slots: [],
  status: "submitted",
  tax_rate: 0,
  tax_amount: 0,
  final_amount: 99,
  photos: [],
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  client_rejection_response: null,
};

const historyState = vi.hoisted(() => ({
  lastEnabled: false,
  items: [] as ProviderProposalHistoryItem[],
  loading: false,
  error: false,
}));

const photoState = vi.hoisted(() => ({
  urls: [] as string[],
  loading: false,
}));

vi.mock("../../hooks/useProviderProposalHistory", () => ({
  useProviderProposalHistory: (_id: string, enabled: boolean) => {
    historyState.lastEnabled = enabled;
    return {
      items: enabled ? historyState.items : [],
      isLoading: enabled && historyState.loading,
      isError: enabled && historyState.error,
      errorMessage: null,
    };
  },
}));

vi.mock("../../hooks/useProviderProposalPhotoUrls", () => ({
  useProviderProposalPhotoUrls: () => ({
    urls: photoState.urls,
    isLoading: photoState.loading,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const withdrawProviderProposal = vi.fn();
vi.mock("../../api/providerProposals.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/providerProposals.api")>(
    "../../api/providerProposals.api",
  );
  return {
    ...actual,
    withdrawProviderProposal: (...a: unknown[]) => withdrawProviderProposal(...a),
  };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("ProviderProposalSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState.lastEnabled = false;
    historyState.items = [historyItem];
    historyState.loading = false;
    historyState.error = false;
    photoState.urls = [];
    photoState.loading = false;
    withdrawProviderProposal.mockResolvedValue({ success: true, error: null });
  });

  it("shows default summary title when proposal is the latest for this provider", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      is_latest_provider_proposal: true,
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(
      screen.getByRole("heading", { name: /seu or.amento mais recente enviado/i }),
    ).toBeInTheDocument();
  });

  it("shows details title when RPC marks a non-latest proposal row", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      is_latest_provider_proposal: false,
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByRole("heading", { name: /^detalhes do or.amento$/i })).toBeInTheDocument();
  });

  it("returns null when no proposal id", () => {
    const job = createMinimalJob({ provider_proposal_id: null });
    const { container } = render(
      <ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />,
      { wrapper: wrapper() },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders edit and withdraw when canEdit", async () => {
    const onEdit = vi.fn();
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 200,
      provider_tax_rate: 0.1,
      provider_tax_amount: 20,
      provider_final_amount: 180,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={onEdit} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /editar or.amento/i }));
    expect(onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() => expect(withdrawProviderProposal).toHaveBeenCalledWith("job-1"));
    expect(toast.success).toHaveBeenCalledWith(
      "Or\u00e7amento retirado com sucesso.",
    );
  });

  it("closes withdraw dialog when user cancels", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows error toast when withdraw does not update a row", async () => {
    withdrawProviderProposal.mockResolvedValue({
      success: false,
      error: "N\u00e3o encontrado",
    });
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("N\u00e3o encontrado"),
    );
  });

  it("shows client rejection response when proposal is rejected", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "rejected",
      provider_proposed_amount: 50,
      provider_proposal_client_rejection_response: "  Muito caro  ",
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByText("Muito caro")).toBeInTheDocument();
    const rejectionLabels = screen.getAllByText((_, el) =>
      Boolean(
        el?.textContent?.includes("Resposta do cliente sobre a rejei\u00e7\u00e3o"),
      ),
    );
    expect(rejectionLabels.length).toBeGreaterThan(0);
  });

  it("hides withdraw button when proposal is rejected", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "rejected",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.queryByRole("button", { name: /retirar or.amento/i })).not.toBeInTheDocument();
  });

  it("treats uppercase REJECTED status like rejected for withdraw visibility", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "REJECTED",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.queryByRole("button", { name: /retirar or.amento/i })).not.toBeInTheDocument();
  });

  it("renders description and tax without rate suffix when rate is null", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 80,
      provider_tax_amount: 8,
      provider_tax_rate: null,
      provider_proposal_description: "Inclui m\u00e3o de obra.",
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByText("Inclui m\u00e3o de obra.")).toBeInTheDocument();
    const taxBlock = screen.getByText(/taxa da plataforma/i).closest("div");
    expect(taxBlock?.textContent).not.toMatch(/%/);
  });

  it("shows error toast when withdraw succeeds but updates zero rows", async () => {
    withdrawProviderProposal.mockResolvedValue({ success: false, error: null });
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const msg = String(vi.mocked(toast.error).mock.calls[0][0]);
    expect(msg).toContain("Nao foi possivel");
    expect(msg).toMatch(/or.amento/);
  });

  it("shows photo grid skeleton while signed urls load", () => {
    photoState.loading = true;
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
      provider_proposal_photos: ["a.jpg", "b.jpg"],
    });
    const { container } = render(
      <ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />,
      { wrapper: wrapper() },
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders resolved proposal photo urls", () => {
    photoState.urls = ["https://signed.example/1.jpg"];
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
      provider_proposal_photos: ["path/1.jpg"],
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(
      screen.getByRole("img", { name: /foto do or.amento 1/i }),
    ).toHaveAttribute("src", "https://signed.example/1.jpg");
  });

  it("shows history skeleton while loading", async () => {
    historyState.loading = true;
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    const { container } = render(
      <ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />,
      { wrapper: wrapper() },
    );
    fireEvent.click(screen.getByText(/ver hist.rico de or.amentos/i));
    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  it("shows history error copy", async () => {
    historyState.error = true;
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByText(/ver hist.rico de or.amentos/i));
    expect(
      await screen.findByText(/n.o foi poss.vel carregar o hist.rico/i),
    ).toBeInTheDocument();
  });

  it("shows empty history message", async () => {
    historyState.items = [];
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByText(/ver hist.rico de or.amentos/i));
    expect(
      await screen.findByText(/nenhum or.amento encontrado/i),
    ).toBeInTheDocument();
  });

  it("shows tax rate percentage when provider_tax_rate is a number", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 100,
      provider_tax_amount: 10,
      provider_tax_rate: 0.12,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });

  it("does not show rejection response block when client message is only whitespace", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "rejected",
      provider_proposed_amount: 50,
      provider_proposal_client_rejection_response: "   \n\t  ",
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(
      screen.queryByText(/resposta do cliente sobre a rejei/i),
    ).not.toBeInTheDocument();
  });

  it("hides action buttons when user cannot edit", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.queryByRole("button", { name: /editar or.amento/i })).not.toBeInTheDocument();
  });

  it("omits amount and description sections when those fields are absent", () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: null,
      provider_tax_amount: null,
      provider_proposal_description: null,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.queryByText("Valor informado")).not.toBeInTheDocument();
    expect(screen.queryByText("Descri\u00e7\u00e3o do or\u00e7amento")).not.toBeInTheDocument();
  });

  it("shows generic error toast when withdraw mutation throws", async () => {
    withdrawProviderProposal.mockRejectedValue(new Error("network"));
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Nao foi possivel retirar o or\u00e7amento.",
      ),
    );
  });

  it("keeps withdraw dialog open while mutation is pending", async () => {
    let finishWithdraw: () => void = () => {};
    withdrawProviderProposal.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWithdraw = () => resolve({ success: true, error: null });
        }),
    );
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar or.amento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    finishWithdraw();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("loads history when accordion opens and opens details dialog", async () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 100,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByText(/ver hist.rico de or.amentos/i));
    await waitFor(() => {
      expect(screen.getByText("Hist\u00f3rico")).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /ver detalhes do or.amento/i }),
    );
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("heading", { name: /detalhes do or.amento/i }),
      ).toBeInTheDocument();
    });
  });

  it("clears proposal details when the details dialog is dismissed", async () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 100,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByText(/ver hist.rico de or.amentos/i));
    await waitFor(() => {
      expect(screen.getByText("Hist\u00f3rico")).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /ver detalhes do or.amento/i }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(
      screen.getByRole("button", { name: /ver detalhes do or.amento/i }),
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
