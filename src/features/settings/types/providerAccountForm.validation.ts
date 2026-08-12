import { z } from "zod";
import { validateFullName } from "@/features/auth";
import { validateCPF, validateCNPJ, validateBrazilPhone } from "@/lib/validators";

const FULL_NAME_MESSAGE = "Informe seu nome completo com nome e sobrenome";

export const providerAccountFormSchema = z
  .object({
    full_name: z
      .string()
      .min(1, "Nome é obrigatório")
      .refine((val) => validateFullName(val) === null, FULL_NAME_MESSAGE),
    phone: z
      .string()
      .refine((val) => !val.trim() || validateBrazilPhone(val), "Telefone inválido"),
    entity_type: z.enum(["pf", "pj"]),
    display_name: z.string().max(120, "Máximo 120 caracteres").optional(),
    bio: z.string().max(2000, "Máximo 2000 caracteres").optional(),
    cpf: z
      .string()
      .refine((val) => !val.trim() || validateCPF(val), "CPF inválido")
      .optional(),
    cnpj: z
      .string()
      .refine((val) => !val.trim() || validateCNPJ(val), "CNPJ inválido")
      .optional(),
    razao_social: z.string().optional(),
    nome_fantasia: z.string().optional(),
    legal_representative_name: z.string().optional(),
    legal_representative_cpf: z
      .string()
      .refine((val) => !val.trim() || validateCPF(val), "CPF do representante inválido")
      .optional(),
    commercial_contact: z.string().max(120, "Máximo 120 caracteres").optional(),
    profile_visibility: z.enum(["public", "restricted"]),
    service_area_city: z.string().optional(),
    service_area_neighborhood_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.entity_type === "pf") return true;
      return Boolean(data.cnpj?.trim() && data.razao_social?.trim());
    },
    { message: "Preencha CNPJ e Razão social para PJ", path: ["cnpj"] }
  );

export type ProviderAccountFormData = z.infer<typeof providerAccountFormSchema>;
