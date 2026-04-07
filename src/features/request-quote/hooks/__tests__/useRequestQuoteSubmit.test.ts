import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRequestQuoteSubmit } from "../useRequestQuoteSubmit";
import type { RequestQuoteState } from "../useRequestQuoteState";

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    useAuth: vi.fn(() => ({
      user: null,
      session: null,
      signUp: vi.fn(),
    })),
    validatePasswordStrength: vi.fn(() => ({ valid: true, errors: [], strength: 5 })),
    clientSignupIdentitySchema: {
      safeParse: vi.fn((data: unknown) => ({ success: true, data })),
    },
    identityToFullName: vi.fn((data: { firstName: string; lastName: string }) =>
      `${data.firstName} ${data.lastName}`.trim()
    ),
    getClientEmailRedirectTo: vi.fn(() => "/"),
  };
});

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({ trackEvent: vi.fn() })),
}));

vi.mock("../../api/createRequestQuoteOrder.api", () => ({
  createRequestQuoteOrder: vi.fn(),
}));

vi.mock("../../utils/requestQuoteDraft.persistence", () => ({
  clearDraft: vi.fn(),
}));

vi.mock("../../utils/photoContentCheck", () => ({
  checkPhotosContent: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/lib/recaptcha", () => ({
  executeRecaptcha: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const useAuth = await import("@/features/auth").then((m) => vi.mocked(m.useAuth));
const useNavigate = await import("react-router").then((m) => vi.mocked(m.useNavigate));
const createRequestQuoteOrder = await import("../../api/createRequestQuoteOrder.api").then(
  (m) => vi.mocked(m.createRequestQuoteOrder)
);
const executeRecaptcha = await import("@/lib/recaptcha").then((m) =>
  vi.mocked(m.executeRecaptcha)
);
const authModule = await import("@/features/auth");
const signUp = vi.fn();
const navigate = vi.fn();

function createMockState(overrides: Partial<RequestQuoteState> = {}): RequestQuoteState {
  return {
    currentStep: 5,
    setCurrentStep: vi.fn(),
    previousStep: 4,
    setPreviousStep: vi.fn(),
    loading: false,
    setLoading: vi.fn(),
    selectedService: {
      id: "s1",
      slug: "limpeza",
      title: "Limpeza",
      description: "",
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
    setSelectedService: vi.fn(),
    step2Data: {},
    setStep2Data: vi.fn(),
    step2FormSchema: null,
    setStep2FormSchema: vi.fn(),
    step2FormVersion: null,
    setStep2FormVersion: vi.fn(),
    step3Data: { description: "Desc", photos: [], photoPreviews: [] },
    setStep3Data: vi.fn(),
    generatingDescription: false,
    setGeneratingDescription: vi.fn(),
    step4Data: { kind: "existing", addressId: "addr-1" },
    setStep4Data: vi.fn(),
    step5Data: {
      firstName: "João",
      lastName: "Silva",
      email: "joao@example.com",
      password: "SecurePass123!",
      confirmPassword: "SecurePass123!",
      termsAccepted: true,
    },
    setStep5Data: vi.fn(),
    orderCreatedEmail: null,
    setOrderCreatedEmail: vi.fn(),
    ...overrides,
  } as unknown as RequestQuoteState;
}

describe("useRequestQuoteSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: null,
      session: null,
      signUp,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
      loadingSession: false,
      profile: null,
      loading: false,
    } as any);
    useNavigate.mockReturnValue(navigate);
    vi.mocked(authModule.clientSignupIdentitySchema.safeParse).mockReturnValue({
      success: true,
      data: {},
    } as any);
    vi.mocked(authModule.validatePasswordStrength).mockReturnValue({
      valid: true,
      errors: [],
      strength: 5,
    });
    signUp.mockResolvedValue({ success: true, userId: "u-new" });
    createRequestQuoteOrder.mockResolvedValue({
      success: true,
      requestId: "req-1",
      addressId: null,
    });
    executeRecaptcha.mockResolvedValue("recaptcha-token");
  });

  describe("handleSubmit (guest)", () => {
    it("validates step5Data and shows toast when validation fails", async () => {
      vi.mocked(authModule.clientSignupIdentitySchema.safeParse).mockReturnValue({
        success: false,
        error: { issues: [{ message: "Email inválido" }] },
      } as any);
      const state = createMockState();
      const trackEvent = vi.fn();
      vi.mocked((await import("@/hooks/useAnalytics")).useAnalytics).mockReturnValue({
        trackEvent,
      } as any);
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(trackEvent).toHaveBeenCalledWith("quote_request_failed", {
        reason: "validation",
      });
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith("Email inválido");
      expect(signUp).not.toHaveBeenCalled();
    });

    it("shows toast when password strength is invalid", async () => {
      vi.mocked(authModule.clientSignupIdentitySchema.safeParse).mockReturnValue({
        success: true,
        data: {},
      } as any);
      vi.mocked(authModule.validatePasswordStrength).mockReturnValue({
        valid: false,
        errors: ["Senha fraca"],
        strength: 0,
      });
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith("Senha fraca");
      expect(signUp).not.toHaveBeenCalled();
    });

    it("calls signUp then createRequestQuoteOrder on guest success", async () => {
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(signUp).toHaveBeenCalledWith(
        "joao@example.com",
        "SecurePass123!",
        "João Silva",
        "client",
        { emailRedirectTo: "/" }
      );
      expect(createRequestQuoteOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u-new",
          email: "joao@example.com",
          session: null,
          recaptchaToken: "recaptcha-token",
        })
      );
      expect(state.setOrderCreatedEmail).toHaveBeenCalledWith("joao@example.com");
    });

    it("bloqueia envio quando não consegue gerar token recaptcha", async () => {
      executeRecaptcha.mockResolvedValue(null);
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(signUp).not.toHaveBeenCalled();
      expect(createRequestQuoteOrder).not.toHaveBeenCalled();
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith(
        "Não foi possível validar o reCAPTCHA. Tente novamente."
      );
    });

    it("navigates to login when signUp returns already_registered", async () => {
      signUp.mockResolvedValue({
        success: false,
        reason: "already_registered",
      });
      const state = createMockState();
      const trackEvent = vi.fn();
      vi.mocked((await import("@/hooks/useAnalytics")).useAnalytics).mockReturnValue({
        trackEvent,
      } as any);
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(trackEvent).toHaveBeenCalledWith("quote_request_guest_already_registered", {
        service_slug: "limpeza",
      });
      expect(navigate).toHaveBeenCalledWith("/login", {
        state: { email: "joao@example.com" },
      });
      expect(createRequestQuoteOrder).not.toHaveBeenCalled();
    });

    it("shows toast and tracks on createRequestQuoteOrder failure", async () => {
      createRequestQuoteOrder.mockResolvedValue({
        success: false,
        error: "Server error",
      });
      const state = createMockState();
      const trackEvent = vi.fn();
      vi.mocked((await import("@/hooks/useAnalytics")).useAnalytics).mockReturnValue({
        trackEvent,
      } as any);
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(trackEvent).toHaveBeenCalledWith("quote_request_failed", {
        reason: "api",
      });
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith(
        "Não foi possível enviar o pedido. Tente novamente.",
      );
    });

    it("shows rate limit message when retryAfter is set", async () => {
      createRequestQuoteOrder.mockResolvedValue({
        success: false,
        error: "Too many requests",
        retryAfter: 60,
      });
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith(
        "Tente novamente em 60 segundos."
      );
    });

    it("calls checkPhotosContent and blocks when not allowed", async () => {
      const { checkPhotosContent } = await import("../../utils/photoContentCheck");
      vi.mocked(checkPhotosContent).mockResolvedValue({
        allowed: false,
        error: "Conteúdo não permitido",
      });
      const state = createMockState({
        step3Data: {
          description: "x",
          photos: [new File([], "p.jpg", { type: "image/jpeg" })],
          photoPreviews: [],
        },
      });
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(checkPhotosContent).toHaveBeenCalled();
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith(
        "Conteúdo não permitido"
      );
      expect(createRequestQuoteOrder).not.toHaveBeenCalled();
    });

    it("catches throw and shows generic error toast", async () => {
      signUp.mockRejectedValue(new Error("Network"));
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect((await import("sonner")).toast.error).toHaveBeenCalledWith(
        "Ocorreu um erro. Tente novamente."
      );
    });
  });

  describe("handleSubmitLoggedIn", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: { id: "u1", email: "u@x.com" },
        session: { access_token: "token" },
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        refreshProfile: vi.fn(),
        getRedirectPath: vi.fn(),
        loadingSession: false,
        profile: null,
        loading: false,
      } as any);
    });

    it("returns early when user or step4Data missing", async () => {
      const state = createMockState({ step4Data: null });
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmitLoggedIn();
      });
      expect(createRequestQuoteOrder).not.toHaveBeenCalled();
    });

    it("calls createRequestQuoteOrder and navigates on success", async () => {
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmitLoggedIn();
      });
      expect(createRequestQuoteOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          email: "u@x.com",
          session: { access_token: "token" },
          recaptchaToken: "recaptcha-token",
        })
      );
      expect((await import("sonner")).toast.success).toHaveBeenCalledWith(
        "Pedido enviado com sucesso!"
      );
      expect((await import("../../utils/requestQuoteDraft.persistence")).clearDraft).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith("/dashboard/client", { replace: true });
    });

    it("sets loading true then false", async () => {
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmitLoggedIn();
      });
      expect(state.setLoading).toHaveBeenCalledWith(true);
      expect(state.setLoading).toHaveBeenCalledWith(false);
    });

    it("handleSubmit when user present delegates to handleSubmitLoggedIn", async () => {
      const state = createMockState();
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(createRequestQuoteOrder).toHaveBeenCalled();
      expect(signUp).not.toHaveBeenCalled();
    });

    it("passes step4Data with location when new address has map coordinates", async () => {
      const step4DataNewWithLocation = {
        kind: "new" as const,
        formData: {
          address_label: "Casa",
          address_zip: "88015-100",
          address_street: "Rua Teste",
          address_number: "100",
          address_complement: "",
          address_neighborhood_id: "n1",
          address_neighborhood: "Centro",
          address_state_id: "s1",
          address_state: "SC",
          address_city_id: "c1",
          address_city: "Florianópolis",
        },
        location: { latitude: -27.5954, longitude: -48.548 },
      };
      const state = createMockState({
        step4Data: step4DataNewWithLocation,
      });
      const { result } = renderHook(() => useRequestQuoteSubmit({ state }));
      await act(async () => {
        await result.current.handleSubmitLoggedIn();
      });
      expect(createRequestQuoteOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          step4Data: expect.objectContaining({
            kind: "new",
            location: { latitude: -27.5954, longitude: -48.548 },
          }),
        })
      );
    });
  });
});
