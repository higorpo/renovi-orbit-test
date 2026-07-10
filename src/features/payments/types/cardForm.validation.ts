import { z } from "zod";
import { validateCPF } from "@/lib/validators";
import {
  isValidCardExpiry,
  isValidCvv,
  isValidLuhn,
  normalizeCardDigits,
  normalizeExpiryYear,
} from "../utils/card-validator";

export const cardFormSchema = z
  .object({
    cardNumber: z
      .string()
      .min(1, "Informe o número do cartão")
      .refine((value) => {
        const digits = normalizeCardDigits(value);
        return digits.length >= 13 && digits.length <= 19;
      }, "Número do cartão inválido")
      .refine((value) => isValidLuhn(value), "Número do cartão inválido"),
    expiryMonth: z
      .string()
      .min(1, "Informe o mês")
      .refine((value) => {
        const month = Number.parseInt(value, 10);
        return Number.isFinite(month) && month >= 1 && month <= 12;
      }, "Mês inválido"),
    expiryYear: z
      .string()
      .min(2, "Informe o ano")
      .refine((value) => normalizeExpiryYear(value) >= 2000, "Ano inválido"),
    cvv: z
      .string()
      .min(1, "Informe o CVV")
      .refine((value) => isValidCvv(value), "CVV inválido"),
    cardholderName: z
      .string()
      .trim()
      .min(1, "Informe o nome impresso no cartão"),
    cardholderCpf: z
      .string()
      .min(1, "Informe o CPF do titular do cartão")
      .refine((value) => validateCPF(value), "CPF inválido. Verifique os números informados."),
    street: z.string().trim().min(1, "Informe o logradouro"),
    number: z.string().trim().min(1, "Informe o número"),
    additionalDetails: z.string().optional(),
    district: z.string().trim().min(1, "Informe o bairro"),
    city: z.string().trim().min(1, "Informe a cidade"),
    state: z
      .string()
      .trim()
      .length(2, "UF deve ter 2 caracteres")
      .transform((value) => value.toUpperCase()),
    zipCode: z
      .string()
      .trim()
      .min(8, "Informe o CEP")
      .refine((value) => normalizeCardDigits(value).length === 8, "CEP inválido"),
  })
  .superRefine((values, context) => {
    const month = Number.parseInt(values.expiryMonth, 10);
    const year = normalizeExpiryYear(values.expiryYear);

    if (!isValidCardExpiry(month, year)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cartão expirado ou data inválida",
        path: ["expiryMonth"],
      });
    }
  });

export type CardFormData = z.infer<typeof cardFormSchema>;

export function defaultCardFormValues(): CardFormData {
  return {
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    cardholderName: "",
    cardholderCpf: "",
    street: "",
    number: "",
    additionalDetails: "",
    district: "",
    city: "",
    state: "",
    zipCode: "",
  };
}
