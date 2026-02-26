import { useState, useCallback, useEffect, useRef } from "react";
import type { FormBlock } from "../types";
import { validateBlockValue } from "../types/helpers";

export type ValidationState = "idle" | "validating" | "valid" | "invalid";

export interface FieldValidationResult {
  state: ValidationState;
  error: string | null;
  isValid: boolean;
  touched: boolean;
}

export interface UseFieldValidationOptions {
  block: FormBlock;
  value: unknown;
  validateOnChange?: boolean;
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 300;
const VALIDATION_DELAY_MS = 50;

export function useFieldValidation({
  block,
  value,
  validateOnChange = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseFieldValidationOptions): {
  validation: FieldValidationResult;
  validate: () => void;
  markAsTouched: () => void;
  reset: () => void;
} {
  const [touched, setTouched] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [error, setError] = useState<string | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;

  const performValidation = useCallback(() => {
    const currentValue = valueRef.current;
    const result = validateBlockValue(block, currentValue);
    if (result.valid) {
      setValidationState("valid");
      setError(null);
    } else {
      setValidationState("validating");
      setTimeout(() => {
        setValidationState("invalid");
        setError(result.error ?? "Campo inválido");
      }, VALIDATION_DELAY_MS);
    }
  }, [block]);

  useEffect(() => {
    if (!touched || !validateOnChange) return;
    const t = setTimeout(performValidation, debounceMs);
    return () => clearTimeout(t);
  }, [value, touched, validateOnChange, performValidation, debounceMs]);

  const markAsTouched = useCallback(() => {
    setTouched(true);
    performValidation();
  }, [performValidation]);

  const reset = useCallback(() => {
    setTouched(false);
    setValidationState("idle");
    setError(null);
  }, []);

  return {
    validation: {
      state: validationState,
      error,
      isValid: validationState === "valid",
      touched,
    },
    validate: performValidation,
    markAsTouched,
    reset,
  };
}

export function getValidationErrorMessage(
  block: FormBlock,
  error: string | null
): string {
  if (!error) return "";
  if (block.validation?.message) return block.validation.message;
  const errorLower = error.toLowerCase();
  if (errorLower.includes("obrigatório") || errorLower.includes("required")) {
    return `${block.label || "Este campo"} é obrigatório`;
  }
  if (errorLower.includes("mínimo") || errorLower.includes("máximo")) return error;
  if (errorLower.includes("formato")) return `Formato inválido. ${block.helpText ?? ""}`.trim();
  if (errorLower.includes("selecione")) return "Selecione pelo menos uma opção";
  return error;
}
