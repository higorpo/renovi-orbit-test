import { z } from "zod";

/**
 * Schema for address form fields (e.g. "new address" step in request-quote).
 * Field names use address_ prefix for form state.
 * State, city and neighborhood must be selected from platform tables (by id).
 */
export const addressFormSchema = z.object({
  address_zip: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido (formato: 00000-000)"),
  address_street: z.string().min(3, "Rua é obrigatória"),
  address_number: z.string().min(1, "Número é obrigatório"),
  address_complement: z.string().optional(),
  address_neighborhood_id: z.string().uuid("Selecione um bairro"),
  address_neighborhood: z.string().min(2, "Bairro é obrigatório"),
  address_state_id: z.string().uuid("Selecione um estado"),
  address_state: z.string().length(2, "UF deve ter 2 caracteres"),
  address_city_id: z.string().uuid("Selecione uma cidade"),
  address_city: z.string().min(2, "Cidade é obrigatória"),
});

export type AddressFormData = z.infer<typeof addressFormSchema>;

export const defaultAddressFormData: AddressFormData = {
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood_id: "",
  address_neighborhood: "",
  address_state_id: "",
  address_state: "",
  address_city_id: "",
  address_city: "",
};
