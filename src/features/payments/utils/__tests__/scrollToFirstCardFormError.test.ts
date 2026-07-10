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

  it("returns undefined when there are no field errors", () => {
    expect(getFirstCardFormErrorField({})).toBeUndefined();
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

  it("returns null when there are no errors to scroll to", () => {
    expect(scrollToFirstCardFormError({})).toBeNull();
  });

  it("scrolls a non-input element without focusing when it is not an HTMLElement", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = CARD_FORM_FIELD_IDS.cvv;
    document.body.appendChild(svg);

    const scrollIntoView = vi.fn();
    (svg as SVGElement & { scrollIntoView: typeof scrollIntoView }).scrollIntoView =
      scrollIntoView;

    const errors = {
      cvv: { type: "too_small", message: "Informe o CVV" },
    } as FieldErrors<CardFormData>;

    expect(scrollToFirstCardFormError(errors)).toBe(svg);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });
});
