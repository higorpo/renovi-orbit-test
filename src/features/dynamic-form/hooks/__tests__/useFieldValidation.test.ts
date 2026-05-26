// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFieldValidation, getValidationErrorMessage } from "../useFieldValidation";
import type { FormBlock } from "../../types";

vi.mock("../../types/helpers", () => ({
  validateBlockValue: vi.fn(),
}));

const { validateBlockValue } = await import("../../types/helpers");

describe("useFieldValidation", () => {
  const block: FormBlock = { id: "f1", type: "text", label: "Field", required: true, description_ai: "Field" };

  beforeEach(() => {
    vi.mocked(validateBlockValue).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns idle state initially when not touched", () => {
    vi.mocked(validateBlockValue).mockReturnValue({ valid: true });
    const { result } = renderHook(() =>
      useFieldValidation({ block, value: "", validateOnChange: false })
    );
    expect(result.current.validation.state).toBe("idle");
    expect(result.current.validation.touched).toBe(false);
  });

  it("marks as touched and runs validation when markAsTouched is called", () => {
    vi.mocked(validateBlockValue).mockReturnValue({ valid: false, error: "Campo obrigatório" });
    const { result } = renderHook(() => useFieldValidation({ block, value: "" }));
    act(() => {
      result.current.markAsTouched();
    });
    expect(result.current.validation.touched).toBe(true);
    expect(validateBlockValue).toHaveBeenCalledWith(block, "");
  });

  it("returns valid state when validateBlockValue returns valid", () => {
    vi.mocked(validateBlockValue).mockReturnValue({ valid: true });
    const { result } = renderHook(() => useFieldValidation({ block, value: "filled" }));
    act(() => {
      result.current.markAsTouched();
    });
    expect(result.current.validation.state).toBe("valid");
    expect(result.current.validation.error).toBeNull();
  });

  it("resets state when reset is called", () => {
    vi.mocked(validateBlockValue).mockReturnValue({ valid: false, error: "Err" });
    const { result } = renderHook(() => useFieldValidation({ block, value: "" }));
    act(() => {
      result.current.markAsTouched();
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.validation.touched).toBe(false);
    expect(result.current.validation.state).toBe("idle");
    expect(result.current.validation.error).toBeNull();
  });

  it("exposes validate function that runs validation", () => {
    vi.mocked(validateBlockValue).mockReturnValue({ valid: true });
    const { result } = renderHook(() => useFieldValidation({ block, value: "x" }));
    act(() => {
      result.current.validate();
    });
    expect(validateBlockValue).toHaveBeenCalledWith(block, "x");
  });
});

describe("getValidationErrorMessage", () => {
  const block: FormBlock = { id: "b1", type: "text", label: "Nome", description_ai: "Nome" };

  it("returns empty string when error is null", () => {
    expect(getValidationErrorMessage(block, null)).toBe("");
  });

  it("returns block validation message when set", () => {
    const blockWithMsg = { ...block, validation: { message: "Mensagem custom" } };
    expect(getValidationErrorMessage(blockWithMsg, "Campo obrigatório")).toBe("Mensagem custom");
  });

  it("returns error as-is when it contains mínimo/máximo", () => {
    expect(getValidationErrorMessage(block, "Valor mínimo: 0")).toBe("Valor mínimo: 0");
  });

  it("returns formatted message for required-like error when no custom message", () => {
    expect(getValidationErrorMessage(block, "Campo obrigatório")).toContain("obrigatório");
  });

  it("uses Este campo when label is missing for required-like error", () => {
    const noLabel = { ...block, label: undefined } as unknown as FormBlock;
    expect(getValidationErrorMessage(noLabel, "required field")).toContain("Este campo");
  });

  it("appends helpText for formato-like errors", () => {
    expect(getValidationErrorMessage(block, "formato inválido")).toContain("Formato inválido");
  });

  it("returns fixed copy for selecione-like errors", () => {
    expect(getValidationErrorMessage(block, "Selecione uma opção")).toBe(
      "Selecione pelo menos uma opção"
    );
  });

  it("returns error unchanged when no rule matches", () => {
    expect(getValidationErrorMessage(block, "Algo inesperado")).toBe("Algo inesperado");
  });
});
