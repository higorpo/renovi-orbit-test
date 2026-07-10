import type { FieldErrors } from "react-hook-form";
import type { CardFormData } from "../types/cardForm.validation";

/** DOM ids for CardForm inputs — keep in sync with CardForm field markup. */
export const CARD_FORM_FIELD_IDS = {
  cardNumber: "checkout-card-number",
  expiryMonth: "checkout-expiry-month",
  expiryYear: "checkout-expiry-year",
  cvv: "checkout-cvv",
  cardholderName: "checkout-cardholder-name",
  cardholderCpf: "checkout-cardholder-cpf",
  street: "checkout-billing-street",
  number: "checkout-billing-number",
  additionalDetails: "checkout-billing-complement",
  district: "checkout-billing-district",
  city: "checkout-billing-city",
  state: "checkout-billing-state",
  zipCode: "checkout-billing-zip",
} as const satisfies Record<keyof CardFormData, string>;

const CARD_FORM_FIELD_ORDER = Object.keys(CARD_FORM_FIELD_IDS) as (keyof CardFormData)[];

export function getFirstCardFormErrorField(
  errors: FieldErrors<CardFormData>,
): keyof CardFormData | undefined {
  return CARD_FORM_FIELD_ORDER.find((name) => Boolean(errors[name]));
}

/** Scrolls (and focuses) the first invalid CardForm field in visual order. */
export function scrollToFirstCardFormError(
  errors: FieldErrors<CardFormData>,
): HTMLElement | null {
  const fieldName = getFirstCardFormErrorField(errors);
  if (!fieldName) {
    return null;
  }

  const element = document.getElementById(CARD_FORM_FIELD_IDS[fieldName]);
  if (!element) {
    return null;
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
  return element;
}
