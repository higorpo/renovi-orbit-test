import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import type { AuthContextType } from "@/features/auth";
import { RequestQuote } from "../RequestQuote";
import {
  mockRequestQuoteState,
} from "./fixtures/requestQuoteTestFixtures";
import { renderWithRequestQuoteProviders } from "./testUtils";

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    useAuth: vi.fn(() => ({ user: null, loadingSession: false })),
  };
});

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams()]),
  };
});

vi.mock("../../../hooks/useRequestQuoteDraft", () => ({
  useRequestQuoteDraft: vi.fn(() => ({
    hasRestorableDraft: false,
    restoreDraft: vi.fn(),
    discardDraft: vi.fn(),
  })),
}));

vi.mock("../../../hooks/useRequestQuoteState", () => ({
  useRequestQuoteState: vi.fn(),
}));

vi.mock("../../../hooks/useRequestQuoteSubmit", () => ({
  useRequestQuoteSubmit: vi.fn(() => ({
    handleSubmit: vi.fn(),
    handleSubmitLoggedIn: vi.fn(),
  })),
}));

vi.mock("../../../hooks/useRequestQuoteServices", () => ({
  useRequestQuoteServices: vi.fn(() => ({
    services: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock("../../../hooks/useServiceSchema", () => ({
  useServiceSchema: vi.fn(() => ({
    schema: null,
    isLoading: false,
    fallbackReason: null,
  })),
}));

vi.mock("../../../hooks/useGenerateSmartDescription", () => ({
  useGenerateSmartDescription: vi.fn(() => ({ generateSmartDescription: vi.fn() })),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({ trackEvent: vi.fn() })),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/features/addresses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/addresses")>();
  return {
    ...actual,
    AddressSelectionStep: () => <div data-testid="address-selection-step">Address</div>,
  };
});

vi.mock("../../ConfirmEmailScreen/ConfirmEmailScreen", () => ({
  ConfirmEmailScreen: ({ email }: { email: string }) => (
    <div data-testid="confirm-email-screen">{email}</div>
  ),
}));

vi.mock("../../TrustSidebar", () => ({
  TrustSidebar: () => <div data-testid="trust-sidebar">Trust</div>,
}));

const useAuth = await import("@/features/auth").then((m) => vi.mocked(m.useAuth));
const useSearchParams = await import("react-router").then((m) => vi.mocked(m.useSearchParams));
const useRequestQuoteDraft = await import("../../../hooks/useRequestQuoteDraft").then((m) =>
  vi.mocked(m.useRequestQuoteDraft)
);
const useRequestQuoteState = await import("../../../hooks/useRequestQuoteState").then((m) =>
  vi.mocked(m.useRequestQuoteState)
);

describe("RequestQuote", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: null,
      loadingSession: false,
      session: null,
      profile: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as AuthContextType);
    useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    useRequestQuoteDraft.mockReturnValue({
      hasRestorableDraft: false,
      restoreDraft: vi.fn(),
      discardDraft: vi.fn(),
    });
    useRequestQuoteState.mockImplementation(() => mockRequestQuoteState());
  });

  it("renders step 1 by default with title and badges", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText(/Contrate profissionais verificados/)).toBeInTheDocument();
    expect(screen.getByText(/2 min/)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento Protegido/)).toBeInTheDocument();
    expect(screen.getByText("Escolha o tipo de serviço")).toBeInTheDocument();
  });

  it("shows Etapa 1 de 5 when user is null (guest)", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument();
  });

  it("shows Etapa 1 de 4 when user is set (logged in)", () => {
    useAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com" },
      loadingSession: false,
      session: null,
      profile: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as unknown as AuthContextType);
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();
  });

  it("shows draft AlertDialog when hasRestorableDraft is true", () => {
    const restoreDraft = vi.fn();
    const discardDraft = vi.fn();
    useRequestQuoteDraft.mockReturnValue({
      hasRestorableDraft: true,
      restoreDraft,
      discardDraft,
    });
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText("Continuar de onde parou?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar de novo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Começar de novo" }));
    expect(discardDraft).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(restoreDraft).toHaveBeenCalled();
  });

  it("shows ConfirmEmailScreen when orderCreatedEmail is set", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({ orderCreatedEmail: "guest@example.com" }) as ReturnType<
        typeof useRequestQuoteState
      >
    );
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByTestId("confirm-email-screen")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-email-screen")).toHaveTextContent("guest@example.com");
    expect(screen.queryByText(/Etapa 1 de/)).not.toBeInTheDocument();
  });

  it("renders step progress when not showConfirmEmail", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument();
  });

  it("Voltar button is disabled on step 1", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.queryByRole("button", { name: /Voltar/i })).not.toBeInTheDocument();
  });

  it("renders step labels for guest (5 steps)", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument();
  });
});