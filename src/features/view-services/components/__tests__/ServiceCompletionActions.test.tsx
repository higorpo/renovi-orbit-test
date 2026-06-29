// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ServiceCompletionActions } from "../ServiceCompletionActions";

const markMutateAsync = vi.fn();
const confirmMutateAsync = vi.fn();

vi.mock("../../hooks/useMarkServiceExecuted", () => ({
  useMarkServiceExecuted: () => ({
    mutateAsync: markMutateAsync,
    isPending: false,
  }),
}));

vi.mock("../../hooks/useConfirmServiceCompleted", () => ({
  useConfirmServiceCompleted: () => ({
    mutateAsync: confirmMutateAsync,
    isPending: false,
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
});
