import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptProposalDialog, type AcceptProposalDialogProps } from "../AcceptProposalDialog";

const {
  checkoutContextMock,
  checkoutHostActionsMock,
  checkoutPrimaryMock,
  checkoutBackMock,
  toastErrorMock,
  useOnlineStatusMock,
} = vi.hoisted(() => ({
  checkoutContextMock: vi.fn(),
  checkoutHostActionsMock: vi.fn(),
  checkoutPrimaryMock: vi.fn(),
  checkoutBackMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useOnlineStatusMock: vi.fn(() => true),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: vi.fn() }),
}));

vi.mock("@/features/payments/hooks/useProposalCheckoutContext", () => ({
  useProposalCheckoutContext: (...args: unknown[]) => checkoutContextMock(...args),
}));

vi.mock("@/features/payments/hooks/useCheckoutStepper", () => ({
  useCheckoutStepper: ({ enabled }: { enabled: boolean }) => ({ enabled }),
}));

vi.mock("@/features/payments/hooks/useCheckoutHostActions", () => ({
  useCheckoutHostActions: (...args: unknown[]) => checkoutHostActionsMock(...args),
}));

vi.mock("@/features/payments/components/CheckoutStepper/CheckoutStepper", () => ({
  CheckoutStepper: ({
    proposalId,
    serviceId,
    checkoutContext,
    onCheckoutSuccess,
  }: {
    proposalId: string;
    serviceId: string;
    checkoutContext: { serviceTitle: string };
    onCheckoutSuccess: () => void;
  }) => (
    <div>
      <span>{`${proposalId}:${serviceId}`}</span>
      <span>{checkoutContext.serviceTitle}</span>
      <button type="button" onClick={onCheckoutSuccess}>
        Complete checkout
      </button>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

const futureSlots = [
  { start_date: "2099-08-12", shift: "morning" as const },
  { start_date: "2099-08-13", shift: "afternoon" as const },
];

function renderDialog(overrides: Partial<AcceptProposalDialogProps> = {}) {
  const props: AcceptProposalDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    chatId: "chat-1",
    serviceRequestId: "request-1",
    proposalId: "proposal-1",
    suggestedSlots: futureSlots,
    serviceTitle: "Instalação elétrica",
    ...overrides,
  };

  render(<AcceptProposalDialog {...props} />);
  return props;
}

describe("AcceptProposalDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOnlineStatusMock.mockReturnValue(true);
    checkoutContextMock.mockReturnValue({
      data: {
        proposedAmount: 350,
        providerId: "provider-1",
        pricingSignature: "pricing-signature",
      },
      isLoading: false,
    });
    checkoutHostActionsMock.mockReturnValue({
      actions: {
        canGoBack: false,
        onBack: checkoutBackMock,
        onPrimary: checkoutPrimaryMock,
        primaryDisabled: false,
        primaryPending: false,
        primaryLabel: "Confirmar pagamento",
      },
      bindings: {},
    });
  });

  it("renders available slots when open", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Aceitar proposta" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
  });

  it("selects another available slot", () => {
    renderDialog();

    fireEvent.click(screen.getAllByRole("radio")[1]);

    expect(screen.getAllByRole("radio")[1]).toBeChecked();
  });

  it("opens checkout and delegates its primary action", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(screen.getByRole("heading", { name: "Pagamento" })).toBeInTheDocument();
    expect(screen.getByText("proposal-1:request-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(checkoutPrimaryMock).toHaveBeenCalledOnce();
  });

  it("closes after checkout succeeds", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete checkout" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns to slot selection from checkout", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("heading", { name: "Aceitar proposta" })).toBeInTheDocument();
    expect(checkoutBackMock).not.toHaveBeenCalled();
  });

  it("delegates back navigation when the checkout stepper can go back", () => {
    checkoutHostActionsMock.mockReturnValue({
      actions: {
        canGoBack: true,
        onBack: checkoutBackMock,
        onPrimary: checkoutPrimaryMock,
        primaryDisabled: false,
        primaryPending: false,
        primaryLabel: "Confirmar pagamento",
      },
      bindings: {},
    });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(checkoutBackMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Pagamento" })).toBeInTheDocument();
  });

  it("closes when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    renderDialog({ isError: true, onRetry });

    expect(screen.getByText("Não foi possível carregar as datas da proposta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Continuar para pagamento" })).toBeDisabled();
  });

  it("blocks acceptance while offline", () => {
    useOnlineStatusMock.mockReturnValue(false);
    renderDialog();

    expect(screen.getByText(/Você está offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar para pagamento" })).toBeDisabled();
  });

  it("reports missing checkout context", () => {
    checkoutContextMock.mockReturnValue({ data: undefined, isLoading: false });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Não foi possível carregar os dados de pagamento. Tente novamente.",
    );
    expect(screen.getByRole("heading", { name: "Aceitar proposta" })).toBeInTheDocument();
  });
});

describe("AcceptProposalDialog branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOnlineStatusMock.mockReturnValue(true);
    checkoutContextMock.mockReturnValue({
      data: {
        proposedAmount: 350,
        providerId: "provider-1",
        pricingSignature: "pricing-signature",
      },
      isLoading: false,
    });
    checkoutHostActionsMock.mockReturnValue({
      actions: {
        canGoBack: false,
        onBack: checkoutBackMock,
        onPrimary: checkoutPrimaryMock,
        primaryDisabled: false,
        primaryPending: false,
        primaryLabel: "Confirmar pagamento",
      },
      bindings: {},
    });
  });

  it("renders the loading skeleton", () => {
    renderDialog({ isLoading: true });

    expect(screen.getByLabelText("Carregando datas disponíveis")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("renders an error without a retry action", () => {
    renderDialog({ isError: true });

    expect(screen.getByText("Não foi possível carregar as datas da proposta.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("distinguishes expired slots from a proposal without dates", () => {
    const { unmount } = render(
      <AcceptProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="request-1"
        proposalId="proposal-1"
        suggestedSlots={[{ start_date: "2000-01-01", shift: "morning" }]}
      />,
    );
    expect(screen.getByText(/não estão mais disponíveis para agendamento/i)).toBeInTheDocument();

    unmount();
    renderDialog({ suggestedSlots: [] });
    expect(screen.getByText(/Não há datas disponíveis nesta proposta/i)).toBeInTheDocument();
  });

  it("shows and invokes revision request while under the limit", () => {
    const onRequestRevision = vi.fn();
    renderDialog({ revisionCount: 1, onRequestRevision });

    fireEvent.click(screen.getByRole("button", { name: /Nenhuma data funciona/i }));
    expect(onRequestRevision).toHaveBeenCalledOnce();
  });

  it("hides revision request when the revision limit is reached", () => {
    renderDialog({ revisionCount: 2, onRequestRevision: vi.fn() });

    expect(screen.queryByRole("button", { name: /Nenhuma data funciona/i })).not.toBeInTheDocument();
  });

  it("does nothing when continue is attempted without a proposal", () => {
    renderDialog({ proposalId: null });
    const continueButton = screen.getByRole("button", { name: "Continuar para pagamento" });

    expect(continueButton).toBeDisabled();
    fireEvent.click(continueButton);
    expect(screen.queryByRole("heading", { name: "Pagamento" })).not.toBeInTheDocument();
  });

  it("does not mount checkout stepper without a service request id", () => {
    renderDialog({ serviceRequestId: null });

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    expect(screen.getByRole("heading", { name: "Pagamento" })).toBeInTheDocument();
    expect(screen.queryByText(/proposal-1:/)).not.toBeInTheDocument();
  });

  it("uses the generic service title when omitted", () => {
    renderDialog({ serviceTitle: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    expect(screen.getByText("Serviço")).toBeInTheDocument();
  });

  it("resets phase and selected slot when reopened", () => {
    const props: AcceptProposalDialogProps = {
      open: true,
      onOpenChange: vi.fn(),
      chatId: "chat-1",
      serviceRequestId: "request-1",
      proposalId: "proposal-1",
      suggestedSlots: futureSlots,
    };
    const { rerender } = render(<AcceptProposalDialog {...props} />);
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    rerender(<AcceptProposalDialog {...props} open={false} />);
    rerender(<AcceptProposalDialog {...props} open />);

    expect(screen.getByRole("heading", { name: "Aceitar proposta" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
  });

  it("disables checkout actions while the primary action is pending", () => {
    checkoutHostActionsMock.mockReturnValue({
      actions: {
        canGoBack: false,
        onBack: checkoutBackMock,
        onPrimary: checkoutPrimaryMock,
        primaryDisabled: true,
        primaryPending: true,
        primaryLabel: "Processando",
      },
      bindings: {},
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Processando" })).toBeDisabled();
  });

  it("shows loading spinner on slot continue while checkout context loads", () => {
    checkoutContextMock.mockReturnValue({ data: undefined, isLoading: true });
    renderDialog();

    const continueBtn = screen.getByRole("button", { name: /Carregando/i });
    expect(continueBtn).toBeDisabled();
    expect(continueBtn).toHaveTextContent("Carregando");
  });

  it("falls back to Continuar label when checkout primaryLabel is missing", () => {
    checkoutHostActionsMock.mockReturnValue({
      actions: {
        canGoBack: false,
        onBack: checkoutBackMock,
        onPrimary: checkoutPrimaryMock,
        primaryDisabled: false,
        primaryPending: false,
        primaryLabel: undefined,
      },
      bindings: {},
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("resets to slot phase when proposalId changes without closing", () => {
    const onOpenChange = vi.fn();
    const baseProps: AcceptProposalDialogProps = {
      open: true,
      onOpenChange,
      chatId: "chat-1",
      serviceRequestId: "request-1",
      proposalId: "proposal-1",
      suggestedSlots: futureSlots,
      serviceTitle: "Instalação elétrica",
    };
    const { rerender } = render(<AcceptProposalDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
    expect(screen.getByRole("heading", { name: "Pagamento" })).toBeInTheDocument();

    rerender(<AcceptProposalDialog {...baseProps} proposalId="proposal-2" />);

    expect(screen.getByRole("heading", { name: "Aceitar proposta" })).toBeInTheDocument();
  });
});
