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

export const stepIdentitySchema = z
  .object({
    firstName: z.string().min(2, "Nome muito curto"),
    lastName: z.string().min(2, "Sobrenome muito curto"),
    email: z.string().email("Email inválido"),
    password: z.string().min(10, "Senha deve ter no mínimo 10 caracteres"),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((v) => v === true, "Você deve aceitar os termos"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type Step4FormData = z.infer<typeof stepAddressSchema>;
export type Step5Data = z.infer<typeof stepIdentitySchema>;

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

export const defaultStep5: Step5Data = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};
