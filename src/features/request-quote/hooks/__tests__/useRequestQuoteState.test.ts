import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRequestQuoteState } from "../useRequestQuoteState";

describe("useRequestQuoteState", () => {
  it("returns initial state with step 1 and empty data", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    expect(result.current.currentStep).toBe(1);
    expect(result.current.previousStep).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.selectedService).toBeNull();
    expect(result.current.step2Data).toEqual({});
    expect(result.current.step2FormSchema).toBeNull();
    expect(result.current.step2FormVersion).toBeNull();
    expect(result.current.step3Data).toEqual({
      description: "",
      photos: [],
      photoPreviews: [],
    });
    expect(result.current.generatingDescription).toBe(false);
    expect(result.current.step4Data).toBeNull();
    expect(result.current.step5Data).toMatchObject({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    });
    expect(result.current.orderCreatedEmail).toBeNull();
  });

  it("setCurrentStep updates currentStep with number", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setCurrentStep(3));
    expect(result.current.currentStep).toBe(3);
  });

  it("setCurrentStep updates currentStep with updater function", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setCurrentStep(2));
    act(() => result.current.setCurrentStep((prev) => prev + 1));
    expect(result.current.currentStep).toBe(3);
  });

  it("setPreviousStep updates previousStep", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setPreviousStep(2));
    expect(result.current.previousStep).toBe(2);
  });

  it("setLoading updates loading", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setLoading(true));
    expect(result.current.loading).toBe(true);
  });

  it("setSelectedService updates selectedService", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    const service = {
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
    };
    act(() => result.current.setSelectedService(service));
    expect(result.current.selectedService).toEqual(service);
  });

  it("setStep2Data updates step2Data", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    const data = { field1: "value1" };
    act(() => result.current.setStep2Data(data));
    expect(result.current.step2Data).toEqual(data);
  });

  it("setStep2FormSchema and setStep2FormVersion update state", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    const schema = { version: "2.0", steps: [] };
    act(() => result.current.setStep2FormSchema(schema));
    act(() => result.current.setStep2FormVersion("2.0"));
    expect(result.current.step2FormSchema).toEqual(schema);
    expect(result.current.step2FormVersion).toBe("2.0");
  });

  it("setStep3Data updates with object", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() =>
      result.current.setStep3Data({
        description: "New desc",
        photos: [],
        photoPreviews: [],
      })
    );
    expect(result.current.step3Data.description).toBe("New desc");
  });

  it("setStep3Data updates with updater function", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() =>
      result.current.setStep3Data((prev) => ({
        ...prev,
        description: "Updated",
      }))
    );
    expect(result.current.step3Data.description).toBe("Updated");
  });

  it("setGeneratingDescription updates generatingDescription", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setGeneratingDescription(true));
    expect(result.current.generatingDescription).toBe(true);
  });

  it("setStep4Data updates step4Data", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    const selection = { kind: "existing" as const, addressId: "addr-1" };
    act(() => result.current.setStep4Data(selection));
    expect(result.current.step4Data).toEqual(selection);
  });

  it("setStep5Data updates with object and with updater", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() =>
      result.current.setStep5Data({
        firstName: "João",
        lastName: "Silva",
        email: "j@x.com",
        password: "x",
        confirmPassword: "x",
        termsAccepted: true,
      })
    );
    expect(result.current.step5Data.firstName).toBe("João");
    act(() =>
      result.current.setStep5Data((prev) => ({ ...prev, lastName: "Santos" }))
    );
    expect(result.current.step5Data.lastName).toBe("Santos");
  });

  it("setOrderCreatedEmail updates orderCreatedEmail", () => {
    const { result } = renderHook(() => useRequestQuoteState());
    act(() => result.current.setOrderCreatedEmail("user@example.com"));
    expect(result.current.orderCreatedEmail).toBe("user@example.com");
  });
});
