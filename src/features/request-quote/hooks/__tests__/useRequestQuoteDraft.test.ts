import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRequestQuoteDraft } from "../useRequestQuoteDraft";
import type { RequestQuoteState } from "../useRequestQuoteState";

vi.mock("../../utils/requestQuoteDraft.persistence", () => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
  buildSerializableDraft: vi.fn((s: RequestQuoteState) => ({
    currentStep: s.currentStep,
    previousStep: s.previousStep,
    selectedService: s.selectedService,
    step2Data: s.step2Data,
    step2FormSchema: s.step2FormSchema,
    step2FormVersion: s.step2FormVersion,
    step3Data: { description: s.step3Data.description, structured: s.step3Data.structured },
    step4Data: s.step4Data,
  })),
  REQUEST_QUOTE_DRAFT_VERSION: "2",
}));

const {
  getDraft,
  saveDraft,
  clearDraft,
  buildSerializableDraft,
} = await import("../../utils/requestQuoteDraft.persistence");

function createMockState(overrides: Partial<RequestQuoteState> = {}): RequestQuoteState {
  const setters = {
    setCurrentStep: vi.fn(),
    setPreviousStep: vi.fn(),
    setSelectedService: vi.fn(),
    setStep2Data: vi.fn(),
    setStep2FormSchema: vi.fn(),
    setStep2FormVersion: vi.fn(),
    setStep3Data: vi.fn(),
    setStep4Data: vi.fn(),
    setStep5Data: vi.fn(),
  };
  return {
    currentStep: 1,
    previousStep: 0,
    loading: false,
    setLoading: vi.fn(),
    selectedService: null,
    step2Data: {},
    step2FormSchema: null,
    step2FormVersion: null,
    step3Data: { description: "", photos: [], photoPreviews: [], structured: null },
    generatingDescription: false,
    setGeneratingDescription: vi.fn(),
    step4Data: null,
    step5Data: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
    orderCreatedEmail: null,
    setOrderCreatedEmail: vi.fn(),
    ...setters,
    ...overrides,
  } as unknown as RequestQuoteState;
}

describe("useRequestQuoteDraft", () => {
  beforeEach(() => {
    vi.mocked(getDraft).mockReturnValue(null);
    vi.mocked(clearDraft).mockClear();
    vi.mocked(saveDraft).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns hasRestorableDraft false when getDraft returns null", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    expect(result.current.hasRestorableDraft).toBe(false);
  });

  it("returns hasRestorableDraft true when getDraft returns draft with matching version", () => {
    const draftPayload = {
      version: "2",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "x" },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    expect(result.current.hasRestorableDraft).toBe(true);
  });

  it("calls clearDraft and does not set restorable when version does not match", () => {
    const draftPayload = {
      version: "0",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    expect(clearDraft).toHaveBeenCalled();
    expect(result.current.hasRestorableDraft).toBe(false);
  });

  it("ignores draft and clears storage when urlServiceSlug is present", () => {
    const draftPayload = {
      version: "2",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "x" },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, "limpeza-profunda"));
    expect(clearDraft).toHaveBeenCalled();
    expect(result.current.hasRestorableDraft).toBe(false);
  });

  it("calls state setters when restoreDraft is called (step5 not restored)", () => {
    const draftPayload = {
      version: "2",
      draft: {
        currentStep: 3,
        previousStep: 2,
        selectedService: null,
        step2Data: { a: 1 },
        step2FormSchema: {},
        step2FormVersion: "v1",
        step3Data: { description: "desc", structured: null },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    expect(result.current.hasRestorableDraft).toBe(true);
    act(() => {
      result.current.restoreDraft();
    });
    expect(state.setCurrentStep).toHaveBeenCalledWith(3);
    expect(state.setPreviousStep).toHaveBeenCalledWith(2);
    expect(state.setStep2Data).toHaveBeenCalledWith({ a: 1 });
    expect(state.setStep3Data).toHaveBeenCalledWith(
      expect.objectContaining({ description: "desc", photos: [], photoPreviews: [] })
    );
    expect(state.setStep5Data).not.toHaveBeenCalled();
  });

  it("calls clearDraft when discardDraft is called", () => {
    const draftPayload = {
      version: "2",
      draft: {
        currentStep: 1,
        previousStep: 0,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    act(() => {
      result.current.discardDraft();
    });
    expect(clearDraft).toHaveBeenCalled();
    expect(result.current.hasRestorableDraft).toBe(false);
  });

  it("restoreDraft does nothing when restorableDraft is null", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    expect(result.current.hasRestorableDraft).toBe(false);
    act(() => {
      result.current.restoreDraft();
    });
    expect(state.setCurrentStep).not.toHaveBeenCalled();
    expect(state.setStep2Data).not.toHaveBeenCalled();
  });

  it("persists draft after debounce when state is meaningful and no restorable dialog", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState({ currentStep: 2 });
    renderHook(() => useRequestQuoteDraft(state, null));
    expect(saveDraft).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(buildSerializableDraft).toHaveBeenCalledWith(state);
    expect(saveDraft).toHaveBeenCalled();
  });

  it("does not persist when orderCreatedEmail is set", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState({
      currentStep: 2,
      orderCreatedEmail: "user@example.com",
    });
    renderHook(() => useRequestQuoteDraft(state, null));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(clearDraft).toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("clears draft when orderCreatedEmail is set (effect)", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState({ orderCreatedEmail: "done@example.com" });
    renderHook(() => useRequestQuoteDraft(state, null));
    expect(clearDraft).toHaveBeenCalled();
  });

  it("does not persist when state is not meaningful", () => {
    vi.mocked(getDraft).mockReturnValue(null);
    const state = createMockState({
      currentStep: 1,
      selectedService: null,
      step2Data: {},
      step3Data: { description: "", photos: [], photoPreviews: [] },
      step4Data: null,
      step5Data: {
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        termsAccepted: false,
      },
    });
    renderHook(() => useRequestQuoteDraft(state, null));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("restores step3Data with structured when draft has structured", () => {
    const draftPayload = {
      version: "2",
      draft: {
        currentStep: 2,
        previousStep: 1,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: {
          description: "d",
          structured: {
            urgency: "high",
            scope_complexity: "medium",
            suggested_equipment: [],
            suggested_materials: [],
            estimated_duration_hint: null,
          },
        },
        step4Data: null,
      },
    };
    vi.mocked(getDraft).mockReturnValue(draftPayload as ReturnType<typeof getDraft>);
    const state = createMockState();
    const { result } = renderHook(() => useRequestQuoteDraft(state, null));
    act(() => {
      result.current.restoreDraft();
    });
    expect(state.setStep3Data).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "d",
        structured: {
          urgency: "high",
          scope_complexity: "medium",
          suggested_equipment: [],
          suggested_materials: [],
          estimated_duration_hint: null,
        },
        photos: [],
        photoPreviews: [],
      })
    );
  });
});
