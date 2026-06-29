// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutCpfApi from "../../../api/checkout.api";
import * as checkoutApi from "../../../api/checkout.api";
import { CheckoutStepper } from "../CheckoutStepper";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" } })),
}));

vi.mock("../../../hooks/useSavedPaymentTokens", () => ({
  useSavedPaymentTokens: vi.fn(() => ({ data: [], isLoading: false })),
  SAVED_PAYMENT_TOKENS_QUERY_KEY: ["payment-tokens", "active"],
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("CheckoutStepper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders ordered steps from payment_get_checkout_step_requirements", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: true,
        needs_phone: true,
        needs_card: true,
      },
      error: null,
    });

    render(<CheckoutStepper providerServiceId="proposal-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("checkout-stepper")).toBeInTheDocument();
    });

    expect(screen.getByTestId("checkout-step-cpf")).toBeInTheDocument();
    expect(screen.getByTestId("checkout-step-indicator-phone")).toBeInTheDocument();
    expect(screen.getByTestId("checkout-step-indicator-confirmation")).toBeInTheDocument();
  });

  it("maps requirements errors to a user-visible message", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: null,
      error: "invalid_checkout_step_requirements_response",
    });

    render(<CheckoutStepper providerServiceId="proposal-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("checkout-stepper-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Não foi possível carregar as etapas do checkout/i),
    ).toBeInTheDocument();
  });

  it("advances to the next resolved step after CPF is saved", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: true,
        needs_phone: false,
        needs_card: true,
      },
      error: null,
    });
    vi.spyOn(checkoutCpfApi, "saveCheckoutCpf").mockResolvedValue({
      cpf: "390.533.447-05",
      error: null,
    });

    render(<CheckoutStepper providerServiceId="proposal-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("checkout-step-cpf")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "39053344705" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("checkout-card-step")).toBeInTheDocument();
    });
  });
});
