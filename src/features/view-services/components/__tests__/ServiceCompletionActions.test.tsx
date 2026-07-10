// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ServiceCompletionActions } from "../ServiceCompletionActions";

const markMutateAsync = vi.fn();
const confirmMutateAsync = vi.fn();
const markPending = vi.hoisted(() => ({ value: false }));
const confirmPending = vi.hoisted(() => ({ value: false }));

vi.mock("../../hooks/useMarkServiceExecuted", () => ({
  useMarkServiceExecuted: () => ({
    mutateAsync: markMutateAsync,
    isPending: markPending.value,
  }),
}));

vi.mock("../../hooks/useConfirmServiceCompleted", () => ({
  useConfirmServiceCompleted: () => ({
    mutateAsync: confirmMutateAsync,
    isPending: confirmPending.value,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ServiceCompletionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markPending.value = false;
    confirmPending.value = false;
  });

  it("shows provider action for CONFIRMED services", () => {
    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="CONFIRMED"
        viewerRole="provider"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Marcar serviço como executado/i }),
    ).toBeInTheDocument();
  });

  it("shows client action for EXECUTED services", () => {
    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="EXECUTED"
        viewerRole="client"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Confirmar recebimento do serviço/i }),
    ).toBeInTheDocument();
  });

  it("calls mark executed for provider", async () => {
    markMutateAsync.mockResolvedValue({
      serviceId: "cs-1",
      status: "EXECUTED",
      executedAt: "2026-06-26T12:00:00.000Z",
    });

    const onSuccess = vi.fn();

    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="CONFIRMED"
        viewerRole="provider"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Marcar serviço como executado/i }));

    await waitFor(() => {
      expect(markMutateAsync).toHaveBeenCalledWith("cs-1");
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows error toast when mark executed fails", async () => {
    const { toast } = await import("sonner");
    markMutateAsync.mockRejectedValue(new Error("falhou marcar"));

    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="CONFIRMED"
        viewerRole="provider"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Marcar serviço como executado/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("falhou marcar");
    });
  });

  it("confirms completion for client and handles errors", async () => {
    const { toast } = await import("sonner");
    confirmMutateAsync.mockResolvedValue({
      serviceId: "cs-1",
      status: "COMPLETED",
      completedAt: "2026-06-26T12:00:00.000Z",
    });

    const onSuccess = vi.fn();
    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="EXECUTED"
        viewerRole="client"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar recebimento do serviço/i }));

    await waitFor(() => {
      expect(confirmMutateAsync).toHaveBeenCalledWith("cs-1");
      expect(onSuccess).toHaveBeenCalled();
    });

    confirmMutateAsync.mockRejectedValue("raw");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar recebimento do serviço/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Falha ao confirmar recebimento.");
    });
  });

  it("renders nothing for unrelated role/status pairs", () => {
    const { container } = render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="PENDING_PAYMENT"
        viewerRole="provider"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows pending labels while mutations run", () => {
    markPending.value = true;
    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="CONFIRMED"
        viewerRole="provider"
      />,
    );
    expect(screen.getByText("Salvando…")).toBeInTheDocument();

    markPending.value = false;
    confirmPending.value = true;
    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="EXECUTED"
        viewerRole="client"
      />,
    );
    expect(screen.getByText("Confirmando…")).toBeInTheDocument();
  });

  it("uses fallback toast when mark executed throws a non-Error", async () => {
    const { toast } = await import("sonner");
    markMutateAsync.mockRejectedValue("raw-failure");

    render(
      <ServiceCompletionActions
        contractedServiceId="cs-1"
        status="CONFIRMED"
        viewerRole="provider"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Marcar serviço como executado/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Falha ao marcar serviço.");
    });
  });
});
