// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CPF_STEP_FORM_ID, PHONE_STEP_FORM_ID } from "../../constants/checkoutFormIds";
import type { UseCheckoutStepperResult } from "../useCheckoutStepper";
import { useCheckoutHostActions } from "../useCheckoutHostActions";

function buildStepper(
  overrides: Partial<UseCheckoutStepperResult> = {},
): UseCheckoutStepperResult {
  return {
    currentStep: "cpf",
    steps: ["cpf", "phone", "card", "installments", "confirmation"],
    stepData: {},
    canGoBack: false,
    goBack: vi.fn(),
    goNext: vi.fn(),
    updateStepData: vi.fn(),
    completeStep: vi.fn(),
    clearsaleSessionId: null,
    setClearsaleSessionId: vi.fn(),
    isLoadingRequirements: false,
    requirementsError: null,
    requirements: { needs_cpf: true, needs_phone: true, needs_card: true },
    refetchRequirements: vi.fn(),
    ...overrides,
  } as UseCheckoutStepperResult;
}

describe("useCheckoutHostActions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null actions while requirements are loading or errored", () => {
    const { result, rerender } = renderHook(
      ({ stepper }) => useCheckoutHostActions(stepper),
      {
        initialProps: {
          stepper: buildStepper({ isLoadingRequirements: true }),
        },
      },
    );

    expect(result.current.actions).toBeNull();

    rerender({
      stepper: buildStepper({
        isLoadingRequirements: false,
        requirementsError: "falha",
      }),
    });

    expect(result.current.actions).toBeNull();
  });

  it("submits the CPF step form on primary action", () => {
    const form = document.createElement("form");
    form.id = CPF_STEP_FORM_ID;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;
    document.body.appendChild(form);

    const { result } = renderHook(() =>
      useCheckoutHostActions(buildStepper({ currentStep: "cpf" })),
    );

    expect(result.current.actions).toMatchObject({
      primaryLabel: "Continuar",
      primaryDisabled: false,
    });

    act(() => {
      result.current.actions?.onPrimary();
    });

    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits the phone step form on primary action", () => {
    const form = document.createElement("form");
    form.id = PHONE_STEP_FORM_ID;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;
    document.body.appendChild(form);

    const { result } = renderHook(() =>
      useCheckoutHostActions(buildStepper({ currentStep: "phone", canGoBack: true })),
    );

    expect(result.current.actions?.canGoBack).toBe(true);

    act(() => {
      result.current.actions?.onPrimary();
    });

    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the step form element is missing", () => {
    const { result } = renderHook(() =>
      useCheckoutHostActions(buildStepper({ currentStep: "cpf" })),
    );

    expect(() => {
      act(() => {
        result.current.actions?.onPrimary();
      });
    }).not.toThrow();
  });

  it("gates card continue until the selector enables it", () => {
    const continueFn = vi.fn();
    const { result } = renderHook(() =>
      useCheckoutHostActions(buildStepper({ currentStep: "card" })),
    );

    expect(result.current.actions?.primaryDisabled).toBe(true);

    act(() => {
      result.current.bindings.cardContinueRef.current = continueFn;
      result.current.bindings.onCanContinueCardChange(true);
    });

    expect(result.current.actions?.primaryDisabled).toBe(false);

    act(() => {
      result.current.actions?.onPrimary();
    });

    expect(continueFn).toHaveBeenCalledTimes(1);
  });

  it("gates installments continue until the selector enables it", () => {
    const continueFn = vi.fn();
    const { result } = renderHook(() =>
      useCheckoutHostActions(buildStepper({ currentStep: "installments" })),
    );

    expect(result.current.actions?.primaryDisabled).toBe(true);

    act(() => {
      result.current.bindings.installmentContinueRef.current = continueFn;
      result.current.bindings.onCanContinueInstallmentsChange(true);
    });

    expect(result.current.actions?.primaryDisabled).toBe(false);

    act(() => {
      result.current.actions?.onPrimary();
    });

    expect(continueFn).toHaveBeenCalledTimes(1);
  });

  it("requires ClearSale session and tracks pending on confirmation", () => {
    const confirmFn = vi.fn();
    const { result, rerender } = renderHook(
      ({ stepper }) => useCheckoutHostActions(stepper),
      {
        initialProps: {
          stepper: buildStepper({
            currentStep: "confirmation",
            clearsaleSessionId: null,
          }),
        },
      },
    );

    expect(result.current.actions).toMatchObject({
      primaryLabel: "Confirmar pagamento",
      primaryDisabled: true,
      primaryPending: false,
    });

    rerender({
      stepper: buildStepper({
        currentStep: "confirmation",
        clearsaleSessionId: "session-1",
      }),
    });

    act(() => {
      result.current.bindings.confirmRef.current = confirmFn;
      result.current.bindings.onConfirmPendingChange(true);
    });

    expect(result.current.actions).toMatchObject({
      primaryDisabled: false,
      primaryPending: true,
    });

    act(() => {
      result.current.actions?.onPrimary();
    });

    expect(confirmFn).toHaveBeenCalledTimes(1);
  });

  it("resets continue gates when the current step changes", () => {
    const { result, rerender } = renderHook(
      ({ stepper }) => useCheckoutHostActions(stepper),
      {
        initialProps: {
          stepper: buildStepper({ currentStep: "card" }),
        },
      },
    );

    act(() => {
      result.current.bindings.onCanContinueCardChange(true);
    });
    expect(result.current.actions?.primaryDisabled).toBe(false);

    rerender({
      stepper: buildStepper({ currentStep: "installments" }),
    });

    expect(result.current.actions?.primaryDisabled).toBe(true);
  });

  it("returns null actions for an unknown step", () => {
    const { result } = renderHook(() =>
      useCheckoutHostActions(
        buildStepper({ currentStep: "unknown" as UseCheckoutStepperResult["currentStep"] }),
      ),
    );

    expect(result.current.actions).toBeNull();
  });
});
