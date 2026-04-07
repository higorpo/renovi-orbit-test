import { describe, it, expect, vi } from "vitest";
import { isRequestQuoteDraftStateMeaningful } from "../requestQuoteDraftMeaningful";
import type { RequestQuoteState } from "../../hooks/useRequestQuoteState";

function baseState(): RequestQuoteState {
  return {
    currentStep: 1,
    setCurrentStep: vi.fn(),
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
    step5Data: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
    setStep5Data: vi.fn(),
    orderCreatedEmail: null,
    setOrderCreatedEmail: vi.fn(),
  } as unknown as RequestQuoteState;
}

describe("isRequestQuoteDraftStateMeaningful", () => {
  it("returns false for a completely blank wizard", () => {
    expect(isRequestQuoteDraftStateMeaningful(baseState())).toBe(false);
  });

  it("returns true when currentStep is greater than 1", () => {
    expect(isRequestQuoteDraftStateMeaningful({ ...baseState(), currentStep: 2 })).toBe(true);
  });

  it("returns true when a service is selected", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        selectedService: { id: "s1" } as RequestQuoteState["selectedService"],
      })
    ).toBe(true);
  });

  it("returns true when step2Data has keys", () => {
    expect(isRequestQuoteDraftStateMeaningful({ ...baseState(), step2Data: { a: 1 } })).toBe(
      true
    );
  });

  it("returns true when description has non-whitespace content", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step3Data: { description: " hi ", photos: [], photoPreviews: [] },
      })
    ).toBe(true);
  });

  it("returns false when description is only whitespace", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step3Data: { description: "   \n", photos: [], photoPreviews: [] },
      })
    ).toBe(false);
  });

  it("returns true when step4Data is set", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step4Data: { kind: "existing", addressId: "a1" } as RequestQuoteState["step4Data"],
      })
    ).toBe(true);
  });

  it("returns true when step5 email has content", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step5Data: {
          firstName: "",
          lastName: "",
          email: "  x@y.com ",
          password: "",
          confirmPassword: "",
          termsAccepted: false,
        },
      })
    ).toBe(true);
  });

  it("returns false when step5 email is only whitespace", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step5Data: {
          firstName: "",
          lastName: "",
          email: "  \t",
          password: "",
          confirmPassword: "",
          termsAccepted: false,
        },
      })
    ).toBe(false);
  });

  it("treats missing step3 description (undefined at runtime) as empty", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step3Data: {
          description: undefined as unknown as string,
          photos: [],
          photoPreviews: [],
        },
      })
    ).toBe(false);
  });

  it("treats missing step5 email (undefined at runtime) as empty", () => {
    expect(
      isRequestQuoteDraftStateMeaningful({
        ...baseState(),
        step5Data: {
          ...baseState().step5Data,
          email: undefined as unknown as string,
        },
      })
    ).toBe(false);
  });
});
