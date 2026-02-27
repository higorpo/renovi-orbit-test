import { z } from "zod";

export const stepAddressSchema = z.object({
  address_zip: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido (formato: 00000-000)"),
  address_street: z.string().min(3, "Rua é obrigatória"),
  address_number: z.string().min(1, "Número é obrigatório"),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().min(2, "Bairro é obrigatório"),
  address_city: z.string().min(2, "Cidade é obrigatória"),
  address_state: z.string().length(2, "UF deve ter 2 caracteres"),
});

export type Step4FormData = z.infer<typeof stepAddressSchema>;

/** Data pushed by Step4 to parent for validation and submit. */
export type Step4Data =
  | { kind: "existing"; addressId: string; city: string; neighborhood: string; state: string }
  | { kind: "new"; formData: Step4FormData }
  | null;

export const defaultStep4: Step4FormData = {
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
};
