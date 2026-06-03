// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerateSmartDescription } from "../useGenerateSmartDescription";
import type { RequestQuoteState } from "../useRequestQuoteState";
import type { GenerateSmartDescriptionResponse } from "../../types/request-quote.types";

vi.mock("../../api/smartDescription.api", () => ({
  invokeGenerateSmartDescription: vi.fn(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({ trackEvent: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const invokeGenerateSmartDescription = await import("../../api/smartDescription.api").then(
  (m) => vi.mocked(m.invokeGenerateSmartDescription)
);

function createMockState(overrides: Partial<RequestQuoteState> = {}): RequestQuoteState {
  return {
    currentStep: 3,
    setCurrentStep: vi.fn(),
    previousStep: 2,
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
    step2Data: { field1: "value1" },
    setStep2Data: vi.fn(),
    step2FormSchema: { version: "2.0" },
    setStep2FormSchema: vi.fn(),
    step2FormVersion: "2.0",
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

describe("useGenerateSmartDescription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets generatingDescription true then false and updates step3Data on success", async () => {
    const state = createMockState();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "Generated description", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(state.setGeneratingDescription).toHaveBeenCalledWith(true);
    expect(state.setGeneratingDescription).toHaveBeenCalledWith(false);
    expect(state.setStep3Data).toHaveBeenCalledWith(
      expect.any(Function)
    );
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updater({ description: "", photos: [], photoPreviews: [] })).toMatchObject({
      description: "Generated description",
    });
  });

  it("includes structured data in step3Data when API returns it", async () => {
    const state = createMockState();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: {
        description: "Desc",
        metadata: {},
        structured: {
          schema_version: 1,
          professional_description: "Pro desc",
          suggested_title: "Instalação de chuveiro",
          confidence: 0.9,
          recommended_next_step: "send_estimate_range",
          urgency: "high",
          scope_complexity: "medium",
          tags: [],
          missing_info_warnings: [],
          suggested_equipment: [],
          suggested_materials: [],
          estimated_duration_hint: null,
        },
      },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const next = updater({ description: "", photos: [], photoPreviews: [] });
    expect(next.structured).toEqual({
      urgency: "high",
      scope_complexity: "medium",
      tags: [],
      missing_info_warnings: [],
      suggested_equipment: [],
      suggested_materials: [],
      estimated_duration_hint: null,
    });
    expect(next.suggestedTitle).toBe("Instalação de chuveiro");
  });

  it("uses top-level suggestedTitle when returned by API", async () => {
    const state = createMockState();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: {
        description: "Desc",
        suggestedTitle: "Troca de tomadas com revisão",
        metadata: {},
      },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const next = updater({ description: "", photos: [], photoPreviews: [] });
    expect(next.suggestedTitle).toBe("Troca de tomadas com revisão");
  });

  it("sends userNotes from step2Data when additional_details key exists", async () => {
    const state = createMockState({ step2Data: { additional_details: "  extra notes  " } });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "OK", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(invokeGenerateSmartDescription).toHaveBeenCalledWith(
      expect.objectContaining({ userNotes: "extra notes" })
    );
  });

  it("sends userNotes from observações key when other keys absent", async () => {
    const state = createMockState({ step2Data: { observações: "  obs accent  " } });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "OK", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(invokeGenerateSmartDescription).toHaveBeenCalledWith(
      expect.objectContaining({ userNotes: "obs accent" })
    );
  });

  it("sends userNotes from observacoes when additional_details missing", async () => {
    const state = createMockState({ step2Data: { observacoes: "obs" } });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "OK", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(invokeGenerateSmartDescription).toHaveBeenCalledWith(
      expect.objectContaining({ userNotes: "obs" })
    );
  });

  it("does not send userNotes when no known key has string value", async () => {
    const state = createMockState({ step2Data: { other: "x", num: 1 } });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "OK", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(invokeGenerateSmartDescription).toHaveBeenCalledWith(
      expect.objectContaining({ userNotes: undefined })
    );
  });

  it("calls onSuccess on success", async () => {
    const state = createMockState();
    const onSuccess = vi.fn();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "Done", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state, onSuccess })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("calls onFailure and shows error toast when API returns error", async () => {
    const state = createMockState();
    const onFailure = vi.fn();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: null,
      error: new Error("API error"),
    });
    const { toast } = await import("sonner");
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state, onFailure })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(onFailure).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Não foi possível gerar"),
      { duration: 5000 }
    );
    expect(state.setGeneratingDescription).toHaveBeenCalledWith(false);
  });

  it("calls onFailure and shows error when data.description is missing", async () => {
    const state = createMockState();
    const onFailure = vi.fn();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { metadata: {} } as GenerateSmartDescriptionResponse,
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state, onFailure })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(onFailure).toHaveBeenCalled();
    expect(state.setGeneratingDescription).toHaveBeenCalledWith(false);
  });

  it("tracks smart_description_used with service_slug when selectedService has slug", async () => {
    const state = createMockState();
    const { useAnalytics } = await import("@/hooks/useAnalytics");
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({
      trackEvent: trackEvent as (eventName: string, properties?: unknown) => void,
    });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "Done", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(trackEvent).toHaveBeenCalledWith("smart_description_used", {
      service_slug: "limpeza",
    });
  });

  it("calls setGeneratingDescription(false) in finally when API throws", async () => {
    const state = createMockState();
    invokeGenerateSmartDescription.mockRejectedValue(new Error("Network"));
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(state.setGeneratingDescription).toHaveBeenLastCalledWith(false);
  });

  it("sends userNotes from detalhes key", async () => {
    const state = createMockState({ step2Data: { detalhes: "  note  " } });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "OK", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(invokeGenerateSmartDescription).toHaveBeenCalledWith(
      expect.objectContaining({ userNotes: "note" })
    );
  });

  it("uses structured suggested_title when top-level suggestedTitle is blank", async () => {
    const state = createMockState();
    invokeGenerateSmartDescription.mockResolvedValue({
      data: {
        description: "Body",
        suggestedTitle: "   ",
        metadata: {},
        structured: {
          schema_version: 1,
          professional_description: "",
          suggested_title: "  From structured  ",
          confidence: 1,
          recommended_next_step: "ask_questions",
          urgency: "medium",
          scope_complexity: "medium",
          tags: [],
          missing_info_warnings: [],
          suggested_equipment: [],
          suggested_materials: [],
          estimated_duration_hint: null,
        },
      },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    const updater = (state.setStep3Data as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const next = updater({ description: "", photos: [], photoPreviews: [] });
    expect(next.suggestedTitle).toBe("From structured");
  });

  it("tracks smart_description_used without service_slug when slug is missing", async () => {
    const state = createMockState({
      selectedService: {
        id: "s1",
        slug: "",
        title: "T",
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
    });
    const { useAnalytics } = await import("@/hooks/useAnalytics");
    const trackEvent = vi.fn();
    vi.mocked(useAnalytics).mockReturnValue({
      trackEvent: trackEvent as (eventName: string, properties?: unknown) => void,
    });
    invokeGenerateSmartDescription.mockResolvedValue({
      data: { description: "Done", metadata: {} },
      error: null,
    });
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(trackEvent).toHaveBeenCalledWith("smart_description_used", {});
  });

  it("handles rejection that is not an Error instance", async () => {
    const state = createMockState();
    const onFailure = vi.fn();
    invokeGenerateSmartDescription.mockRejectedValue("plain string");
    const { result } = renderHook(() =>
      useGenerateSmartDescription({ state, onFailure })
    );
    await act(async () => {
      await result.current.generateSmartDescription();
    });
    expect(onFailure).toHaveBeenCalled();
    expect(state.setGeneratingDescription).toHaveBeenLastCalledWith(false);
  });
});
