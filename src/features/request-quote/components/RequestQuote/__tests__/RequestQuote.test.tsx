import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { AuthContextType } from "@/features/auth";
import { RequestQuote } from "../RequestQuote";
import {
  mockRequestQuoteState,
  mockFormSchema,
  mockServiceWithChildren,
} from "./fixtures/requestQuoteTestFixtures";
import { renderWithRequestQuoteProviders } from "./testUtils";

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    useAuth: vi.fn(() => ({ user: null, loadingSession: false })),
  };
});

const useRequestQuoteSubmit = await import("../../../hooks/useRequestQuoteSubmit").then((m) =>
  vi.mocked(m.useRequestQuoteSubmit)
);

const validIdentity = {
  firstName: "João",
  lastName: "Silva",
  email: "joao@example.com",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
  termsAccepted: true,
};

const loggedInAuth = {
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
} as unknown as AuthContextType;

describe("RequestQuote additional branches", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      ...loggedInAuth,
      user: null,
    } as AuthContextType);
    useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    useRequestQuoteDraft.mockReturnValue({
      hasRestorableDraft: false,
      restoreDraft: vi.fn(),
      discardDraft: vi.fn(),
    });
    useServiceSchema.mockReturnValue({
      schema: null,
      isLoading: false,
      fallbackReason: null,
    });
    useRequestQuoteSubmit.mockReturnValue({
      handleSubmit: vi.fn(),
      handleSubmitLoggedIn: vi.fn(),
    });
  });

  it.each([
    [0, "Escolha o tipo de serviço"],
    [99, "Seus dados"],
  ])("clamps current step %s to a renderable step", (currentStep, expectedText) => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({ currentStep, step5Data: validIdentity }) as ReturnType<
        typeof useRequestQuoteState
      >,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("disables Próximo when step 4 data is null", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({ currentStep: 4, step4Data: null }) as ReturnType<
        typeof useRequestQuoteState
      >,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeDisabled();
  });

  it("disables Próximo for an invalid new address", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step4Data: { kind: "new", formData: {} as never },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeDisabled();
  });

  it("enables Próximo for an existing address", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step4Data: { kind: "existing", addressId: "address-1" },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeEnabled();
  });

  it("enables Próximo for a valid new address on step 4", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step4Data: {
          kind: "new",
          formData: {
            address_label: "Casa",
            address_zip: "01310-100",
            address_street: "Avenida Paulista",
            address_number: "1000",
            address_complement: "",
            address_neighborhood_id: "11111111-1111-4111-8111-111111111111",
            address_neighborhood: "Bela Vista",
            address_state_id: "22222222-2222-4222-8222-222222222222",
            address_state: "SP",
            address_city_id: "33333333-3333-4333-8333-333333333333",
            address_city: "São Paulo",
          },
        },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeEnabled();
  });

  it("enables Próximo on step 3 when description is filled", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 3,
        step3Data: {
          description: "Preciso de um eletricista",
          photos: [],
          photoPreviews: [],
        },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeEnabled();
  });

  it("disables Enviar pedido for logged-in user with invalid new address", () => {
    useAuth.mockReturnValue(loggedInAuth);
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step4Data: { kind: "new", formData: {} as never },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Enviar pedido/i })).toBeDisabled();
  });

  it("enables final submit for a logged-in user with an existing address", () => {
    useAuth.mockReturnValue(loggedInAuth);
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step4Data: { kind: "existing", addressId: "address-1" },
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Enviar pedido/i })).toBeEnabled();
  });

  it("enables guest submit when step 5 identity is valid", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 5,
        step5Data: validIdentity,
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByRole("button", { name: /Enviar pedido/i })).toBeEnabled();
  });

  it("invokes submit when Enviar pedido is clicked", () => {
    const handleSubmit = vi.fn();
    useRequestQuoteSubmit.mockReturnValue({
      handleSubmit,
      handleSubmitLoggedIn: vi.fn(),
    });
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 5,
        step5Data: validIdentity,
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido/i }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders the mobile TrustSidebar only on step 1", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({ currentStep: 1 }) as ReturnType<
        typeof useRequestQuoteState
      >,
    );
    const { rerender } = renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getAllByTestId("trust-sidebar")).toHaveLength(2);

    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 2,
        selectedService: mockServiceWithChildren,
      }) as ReturnType<typeof useRequestQuoteState>,
    );
    rerender(<RequestQuote />);

    expect(screen.getAllByTestId("trust-sidebar")).toHaveLength(1);
  });

  it("renders Step5Identity for a guest on step 5", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 5,
        step5Data: validIdentity,
      }) as ReturnType<typeof useRequestQuoteState>,
    );

    renderWithRequestQuoteProviders(<RequestQuote />);

    expect(screen.getByText("Seus dados")).toBeInTheDocument();
  });
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

vi.mock("@/features/dynamic-form/utils/schemaValidator", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/dynamic-form/utils/schemaValidator")
  >();
  return {
    ...actual,
    validateFormSchema: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  };
});

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
const useServiceSchema = await import("../../../hooks/useServiceSchema").then((m) =>
  vi.mocked(m.useServiceSchema)
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

  it("logo links to home", () => {
    renderWithRequestQuoteProviders(<RequestQuote />);
    const logo = screen.getByRole("link", { name: /Prestway/i });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("passes urlServiceSlug from search params to draft and navigation", () => {
    const searchParams = new URLSearchParams({ serviceSlug: "limpeza-profunda" });
    useSearchParams.mockReturnValue([searchParams, vi.fn()]);
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(useRequestQuoteDraft).toHaveBeenCalledWith(
      expect.anything(),
      "limpeza-profunda",
      null,
    );
  });

  it("shows SectionTitleWithIcon on step 2 when selectedService is set", () => {
    const state = mockRequestQuoteState({
      currentStep: 2,
      selectedService: {
        id: "svc-1",
        slug: "limpeza",
        title: "Limpeza",
        description: "Serviço",
        active: true,
        show_on_request_quote: true,
        parent_id: null,
        form_id: "f1",
        icon_key: "Wrench",
        color_key: "slate",
        image_url: null,
        sort_order: 0,
        created_at: "",
        updated_at: "",
        ai_prompt_id: null,
      },
      step2Data: { field1: "x" },
    });
    useRequestQuoteState.mockReturnValue(state);
    useServiceSchema.mockReturnValue({
      schema: mockFormSchema,
      fallbackReason: null,
      isLoading: false,
    });
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(
      screen.getByText("Nos conte mais sobre o serviço")
    ).toBeInTheDocument();
  });

  it("Próximo is disabled on step 3 when description is empty", () => {
    const state = mockRequestQuoteState({
      currentStep: 3,
      step3Data: {
        description: "",
        photos: [],
        photoPreviews: [],
      },
      generatingDescription: false,
    });
    useRequestQuoteState.mockReturnValue(state);
    renderWithRequestQuoteProviders(<RequestQuote />);
    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    expect(nextBtn).toBeDisabled();
  });

  it("Próximo is disabled on step 3 when generatingDescription is true", () => {
    const state = mockRequestQuoteState({
      currentStep: 3,
      step3Data: {
        description: "Some text",
        photos: [],
        photoPreviews: [],
      },
      generatingDescription: true,
    });
    useRequestQuoteState.mockReturnValue(state);
    renderWithRequestQuoteProviders(<RequestQuote />);
    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    expect(nextBtn).toBeDisabled();
  });

  it("Voltar is visible on step 3 and handleBack is called when clicked", () => {
    const state = mockRequestQuoteState({
      currentStep: 3,
      step3Data: {
        description: "Done",
        photos: [],
        photoPreviews: [],
      },
    });
    useRequestQuoteState.mockReturnValue(state);
    renderWithRequestQuoteProviders(<RequestQuote />);
    const voltarBtn = screen.getByRole("button", { name: /Voltar/i });
    expect(voltarBtn).toBeInTheDocument();
    fireEvent.click(voltarBtn);
    const setCurrentStepMock = vi.mocked(state.setCurrentStep);
    expect(setCurrentStepMock).toHaveBeenCalled();
    const updater = setCurrentStepMock.mock.calls[0]?.[0];
    expect(typeof updater).toBe("function");
    expect((updater as (prev: number) => number)(3)).toBe(2);
  });

  it("Enviar pedido is disabled on step 5 when step5Data is invalid", () => {
    const state = mockRequestQuoteState({
      currentStep: 5,
      step5Data: {
        firstName: "J",
        lastName: "S",
        email: "invalid",
        password: "short",
        confirmPassword: "other",
        termsAccepted: false,
      },
    });
    useRequestQuoteState.mockReturnValue(state);
    renderWithRequestQuoteProviders(<RequestQuote />);
    const submitBtn = screen.getByRole("button", { name: /Enviar pedido/i });
    expect(submitBtn).toBeDisabled();
  });

  it("renders address step on guest step 4", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step3Data: { description: "ok", photos: [], photoPreviews: [] },
        step4Data: { kind: "new", formData: {} as never },
      }) as ReturnType<typeof useRequestQuoteState>
    );
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByTestId("address-selection-step")).toBeInTheDocument();
    expect(screen.getByText(/Etapa 4 de 5/)).toBeInTheDocument();
  });

  it("renders address step on logged-in step 4", () => {
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
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 4,
        step3Data: { description: "ok", photos: [], photoPreviews: [] },
        step4Data: { kind: "existing", addressId: "a1" },
      }) as ReturnType<typeof useRequestQuoteState>
    );
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByTestId("address-selection-step")).toBeInTheDocument();
    expect(screen.getByText(/Etapa 4 de 4/)).toBeInTheDocument();
  });

  it("shows step header labels for guest on step 3", () => {
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 3,
        step3Data: { description: "done", photos: [], photoPreviews: [] },
      }) as ReturnType<typeof useRequestQuoteState>
    );
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Detalhes")).toBeInTheDocument();
    expect(screen.getByText("Descrição")).toBeInTheDocument();
  });

  it("calls setPreviousStep with prior step when currentStep advances between renders", () => {
    const stateAt2 = mockRequestQuoteState({ currentStep: 2 });
    useRequestQuoteState.mockReturnValue(stateAt2 as ReturnType<typeof useRequestQuoteState>);
    const { rerender } = renderWithRequestQuoteProviders(<RequestQuote />);
    useRequestQuoteState.mockReturnValue({
      ...stateAt2,
      currentStep: 3,
    } as ReturnType<typeof useRequestQuoteState>);
    rerender(<RequestQuote />);
    expect(stateAt2.setPreviousStep).toHaveBeenCalledWith(2);
  });

  it("clamps step to 4 when user is logged in and state was on guest step 5", () => {
    const setCurrentStep = vi.fn();
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
    useRequestQuoteState.mockReturnValue(
      mockRequestQuoteState({
        currentStep: 5,
        setCurrentStep,
      }) as ReturnType<typeof useRequestQuoteState>
    );
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(setCurrentStep).toHaveBeenCalledWith(4);
  });

  it("advances to step 3 when guest completes DynamicForm on step 2", async () => {
    useServiceSchema.mockReturnValue({
      schema: mockFormSchema,
      isLoading: false,
      fallbackReason: null,
    });
    const state = mockRequestQuoteState({
      currentStep: 2,
      selectedService: mockServiceWithChildren,
      step2Data: {},
    });
    useRequestQuoteState.mockReturnValue(state as ReturnType<typeof useRequestQuoteState>);
    renderWithRequestQuoteProviders(<RequestQuote />);
    fireEvent.change(screen.getByRole("textbox", { name: /Campo/i }), {
      target: { value: "filled" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Concluir/i }));
    await waitFor(() => {
      expect(state.setCurrentStep).toHaveBeenCalledWith(3);
    });
    expect(state.setStep2FormSchema).toHaveBeenCalled();
    expect(state.setStep2FormVersion).toHaveBeenCalledWith("2.0");
  });

  it("returns to step 1 when guest cancels DynamicForm on step 2", async () => {
    useServiceSchema.mockReturnValue({
      schema: mockFormSchema,
      isLoading: false,
      fallbackReason: null,
    });
    const state = mockRequestQuoteState({
      currentStep: 2,
      selectedService: mockServiceWithChildren,
      step2Data: {},
    });
    useRequestQuoteState.mockReturnValue(state as ReturnType<typeof useRequestQuoteState>);
    renderWithRequestQuoteProviders(<RequestQuote />);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(state.setCurrentStep).toHaveBeenCalledWith(1);
  });

  it("Enviar pedido shows loader when loading is true", () => {
    const state = mockRequestQuoteState({
      currentStep: 5,
      loading: true,
      step5Data: {
        firstName: "João",
        lastName: "Silva",
        email: "joao@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
        termsAccepted: true,
      },
    });
    useRequestQuoteState.mockReturnValue(state);
    renderWithRequestQuoteProviders(<RequestQuote />);
    expect(screen.getByRole("button", { name: /Enviar pedido/i })).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});