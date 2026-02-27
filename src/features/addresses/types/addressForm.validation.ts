import { z } from "zod";

/**
 * Schema for address form fields (e.g. "new address" step in request-quote).
 * Field names use address_ prefix for form state.
 */
export const addressFormSchema = z.object({
  address_zip: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido (formato: 00000-000)"),
  address_street: z.string().min(3, "Rua é obrigatória"),
  address_number: z.string().min(1, "Número é obrigatório"),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().min(2, "Bairro é obrigatório"),
  address_city: z.string().min(2, "Cidade é obrigatória"),
  address_state: z.string().length(2, "UF deve ter 2 caracteres"),
});

export type AddressFormData = z.infer<typeof addressFormSchema>;

export const defaultAddressFormData: AddressFormData = {
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
};
