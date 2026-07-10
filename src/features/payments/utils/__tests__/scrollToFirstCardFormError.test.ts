// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FieldErrors } from "react-hook-form";
import type { CardFormData } from "../../types/cardForm.validation";
import {
  CARD_FORM_FIELD_IDS,
  getFirstCardFormErrorField,
  scrollToFirstCardFormError,
} from "../scrollToFirstCardFormError";

describe("getFirstCardFormErrorField", () => {
  it("returns the first field in form order when multiple fail", () => {
    const errors = {
      zipCode: { type: "too_small", message: "Informe o CEP" },
      cardNumber: { type: "too_small", message: "Informe o número do cartão" },
      street: { type: "too_small", message: "Informe o logradouro" },
    } as FieldErrors<CardFormData>;

    expect(getFirstCardFormErrorField(errors)).toBe("cardNumber");
  });
});

describe("scrollToFirstCardFormError", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls and focuses the first invalid field", () => {
    const input = document.createElement("input");
    input.id = CARD_FORM_FIELD_IDS.street;
    document.body.appendChild(input);

    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    input.scrollIntoView = scrollIntoView;
    input.focus = focus;

    const errors = {
      street: { type: "too_small", message: "Informe o logradouro" },
    } as FieldErrors<CardFormData>;

    expect(scrollToFirstCardFormError(errors)).toBe(input);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("returns null when the field element is missing", () => {
    const errors = {
      cardNumber: { type: "too_small", message: "Informe o número do cartão" },
    } as FieldErrors<CardFormData>;

    expect(scrollToFirstCardFormError(errors)).toBeNull();
  });
});
