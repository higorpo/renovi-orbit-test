// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRequestQuoteNavigation } from "../useRequestQuoteNavigation";
import type { RequestQuoteState } from "../useRequestQuoteState";

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({ trackEvent: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/features/addresses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/addresses")>();
  return {
    ...actual,
    addressFormSchema: {
      safeParse: vi.fn((data: unknown) => ({ success: true, data })),
    },
  };
});

const toast = await import("sonner").then((m) => m.toast);
const useAnalytics = await import("@/hooks/useAnalytics").then((m) =>
  vi.mocked(m.useAnalytics)
);

function createMockState(overrides: Partial<RequestQuoteState> = {}): RequestQuoteState {
  const setCurrentStep = vi.fn();
  return {
    currentStep: 1,
    setCurrentStep,
    previousStep: 0,
    setPreviousStep: vi.fn(),
    loading: false,
    setLoading: vi.fn(),
    selectedService: null,
    setSelectedService: vi.fn(),
    step2Data: {},
    setStep2Data: vi.fn(),
    step2FormSchema: null,
    setStep2FormSchema: vi.fn(),
    step2FormVersion: null,
    setStep2FormVersion: vi.fn(),
    step3Data: { description: "", photos: [], photoPreviews: [] },
    setStep3Data: vi.fn(),
    generatingDescription: false,
    setGeneratingDescription: vi.fn(),
    step4Data: null,
    setStep4Data: vi.fn(),
    step5Data: {} as RequestQuoteState["step5Data"],
    setStep5Data: vi.fn(),
    orderCreatedEmail: null,
    setOrderCreatedEmail: vi.fn(),
    ...overrides,
  } as unknown as RequestQuoteState;
}

describe("useRequestQuoteNavigation", () => {
  beforeEach(() => {
    vi.mocked(useAnalytics).mockReturnValue({ trackEvent: vi.fn() } as any);
    vi.mocked(toast.error).mockClear();
  });

  it("returns totalSteps 5 when user is null", () => {
    const state = createMockState();
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    expect(result.current.totalSteps).toBe(5);
  });

  it("returns totalSteps 4 when user is set", () => {
    const state = createMockState();
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: { id: "u1" },
        onSubmitLoggedIn: vi.fn(),
      })
    );
    expect(result.current.totalSteps).toBe(4);
  });

  it("tracks quote_request_started on step 1 with urlServiceSlug", () => {
    const state = createMockState({ currentStep: 1 });
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({ trackEvent } as any);
    renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
        urlServiceSlug: "limpeza",
      })
    );
    expect(trackEvent).toHaveBeenCalledWith("quote_request_started", {
      is_logged_in: false,
      service_slug: "limpeza",
    });
  });

  it("tracks quote_request_started without service_slug when urlServiceSlug is null", () => {
    const state = createMockState({ currentStep: 1 });
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({ trackEvent } as any);
    renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    expect(trackEvent).toHaveBeenCalledWith("quote_request_started", {
      is_logged_in: false,
    });
  });

  it("handleNext step 1 without selectedService shows toast and does not advance", async () => {
    const state = createMockState({ currentStep: 1, selectedService: null });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith("Selecione um serviço para continuar.");
    expect(state.setCurrentStep).not.toHaveBeenCalled();
  });

  it("handleNext step 2 with empty step2Data shows toast", async () => {
    const state = createMockState({
      currentStep: 2,
      selectedService: { id: "s1", slug: "x", title: "X" } as any,
      step2Data: {},
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Preencha os campos do formulário do serviço para continuar."
    );
  });

  it("handleNext step 2 with step2Data advances to step 3", async () => {
    const state = createMockState({
      currentStep: 2,
      selectedService: { id: "s1", slug: "x" } as any,
      step2Data: { field1: "v" },
    });
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({ trackEvent } as any);
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(state.setCurrentStep).toHaveBeenCalledWith(3);
    expect(trackEvent).toHaveBeenCalledWith("quote_request_step_completed", {
      step: 2,
      is_logged_in: false,
      total_steps: 5,
    });
  });

  it("handleNext step 3 without description shows toast", async () => {
    const state = createMockState({
      currentStep: 3,
      step3Data: { description: "   ", photos: [], photoPreviews: [] },
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith("Adicione uma descrição do serviço.");
  });

  it("handleNext step 3 with description advances to step 4", async () => {
    const state = createMockState({
      currentStep: 3,
      step3Data: { description: "Done", photos: [], photoPreviews: [] },
      step4Data: { kind: "new", formData: {} as any },
    });
    const { addressFormSchema } = await import("@/features/addresses");
    vi.mocked(addressFormSchema.safeParse).mockReturnValue({
      success: true,
      data: {},
    } as any);
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(state.setCurrentStep).toHaveBeenCalled();
    const updater = (state.setCurrentStep as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(3)).toBe(4);
  });

  it("handleNext step 4 logged in without step4Data shows toast", async () => {
    const state = createMockState({
      currentStep: 4,
      step4Data: null,
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: { id: "u1" },
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Selecione um endereço ou cadastre um novo."
    );
  });

  it("handleNext step 4 logged in with existing address calls onSubmitLoggedIn", async () => {
    const state = createMockState({
      currentStep: 4,
      step4Data: { kind: "existing", addressId: "addr-1" },
    });
    const onSubmitLoggedIn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: { id: "u1" },
        onSubmitLoggedIn,
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(onSubmitLoggedIn).toHaveBeenCalled();
  });

  it("handleNext step 4 guest without step4Data or kind new shows toast", async () => {
    const state = createMockState({
      currentStep: 4,
      step4Data: null,
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith("Preencha o endereço.");
  });

  it("handleBack decrements step", () => {
    const state = createMockState({ currentStep: 3 });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    act(() => result.current.handleBack());
    expect(state.setCurrentStep).toHaveBeenCalled();
    const updater = (state.setCurrentStep as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(3)).toBe(2);
  });

  it("handleBack does not go below 1", () => {
    const state = createMockState({ currentStep: 1 });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    act(() => result.current.handleBack());
    const updater = (state.setCurrentStep as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(1)).toBe(1);
  });

  it("handleServiceSelect sets service, resets step2, and goes to step 2", () => {
    const state = createMockState();
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({ trackEvent } as any);
    const service = {
      id: "s1",
      slug: "limpeza",
      title: "Limpeza",
    } as any;
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    act(() => result.current.handleServiceSelect(service));
    expect(trackEvent).toHaveBeenCalledWith("service_selected", {
      service_id: "s1",
      service_slug: "limpeza",
    });
    expect(state.setSelectedService).toHaveBeenCalledWith(service);
    expect(state.setStep2Data).toHaveBeenCalledWith({});
    expect(state.setStep2FormSchema).toHaveBeenCalledWith(null);
    expect(state.setStep2FormVersion).toHaveBeenCalledWith(null);
    expect(state.setCurrentStep).toHaveBeenCalledWith(2);
  });

  it("handleNext step 1 with selectedService advances to step 2", async () => {
    const state = createMockState({
      currentStep: 1,
      selectedService: { id: "s1", slug: "x", title: "X" } as never,
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(state.setCurrentStep).toHaveBeenCalled();
    const updater = (state.setCurrentStep as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(1)).toBe(2);
  });

  it("handleNext step 4 logged in with new address and valid formData calls onSubmitLoggedIn", async () => {
    const { addressFormSchema } = await import("@/features/addresses");
    vi.mocked(addressFormSchema.safeParse).mockReturnValue({
      success: true,
      data: {},
    } as never);
    const state = createMockState({
      currentStep: 4,
      step4Data: { kind: "new", formData: { ok: true } as never },
    });
    const onSubmitLoggedIn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: { id: "u1" },
        onSubmitLoggedIn,
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(onSubmitLoggedIn).toHaveBeenCalled();
  });

  it("handleNext step 4 guest with new valid address advances to step 5", async () => {
    const { addressFormSchema } = await import("@/features/addresses");
    vi.mocked(addressFormSchema.safeParse).mockReturnValue({
      success: true,
      data: {},
    } as never);
    const state = createMockState({
      currentStep: 4,
      step4Data: { kind: "new", formData: { ok: true } as never },
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: null,
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    const updater = (state.setCurrentStep as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater(4)).toBe(5);
  });

  it("handleNext step 4 logged in with new address and invalid formData shows toast", async () => {
    const { addressFormSchema } = await import("@/features/addresses");
    vi.mocked(addressFormSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: "Invalid address" }] },
    } as any);
    const state = createMockState({
      currentStep: 4,
      step4Data: { kind: "new", formData: {} as any },
    });
    const { result } = renderHook(() =>
      useRequestQuoteNavigation({
        state,
        user: { id: "u1" },
        onSubmitLoggedIn: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleNext();
    });
    expect(toast.error).toHaveBeenCalledWith("Invalid address");
  });
});
