import type { DispatchKycEmailBody, KycEntityType } from "./types.ts";

export type ValidateDispatchKycResult =
  | { ok: true; body: DispatchKycEmailBody }
  | { ok: false; status: number; errorCode: string; error: string; field?: string };

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function parseEntityType(value: unknown): KycEntityType | null {
  if (value === "CPF" || value === "CNPJ") {
    return value;
  }
  return null;
}

export function isRetryOnlyDispatchBody(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") {
    return false;
  }

  const body = raw as Record<string, unknown>;
  return body.retry_only === true;
}

export function validateDispatchKycEmailBody(
  raw: unknown,
): ValidateDispatchKycResult {
  if (raw === null || typeof raw !== "object") {
    return {
      ok: false,
      status: 400,
      errorCode: "KYC_REQUIRED_FIELDS_MISSING",
      error: "Invalid request body",
    };
  }

  const body = raw as Record<string, unknown>;

  if (body.retry_only === true) {
    return {
      ok: true,
      body: {
        retry_only: true,
        entity_type: "CPF",
        full_name: "",
        document: "",
        phone: "",
        email: "",
        bank_institution_code: "",
        bank_branch: "",
        bank_account: "",
      },
    };
  }
  const entityType = parseEntityType(body.entity_type);
  if (!entityType) {
    return {
      ok: false,
      status: 422,
      errorCode: "KYC_REQUIRED_FIELDS_MISSING",
      error: "entity_type is required",
      field: "entity_type",
    };
  }

  const document = digitsOnly(String(body.document ?? ""));
  const expectedLength = entityType === "CPF" ? CPF_LENGTH : CNPJ_LENGTH;
  if (document.length !== expectedLength) {
    return {
      ok: false,
      status: 422,
      errorCode: "INVALID_DOCUMENT",
      error: "Documento inválido",
      field: "document",
    };
  }

  const requiredFields: Array<[keyof DispatchKycEmailBody, string]> = [
    ["full_name", "full_name"],
    ["phone", "phone"],
    ["email", "email"],
    ["bank_institution_code", "bank_institution_code"],
    ["bank_branch", "bank_branch"],
    ["bank_account", "bank_account"],
  ];

  for (const [field] of requiredFields) {
    if (!isNonEmpty(body[field])) {
      return {
        ok: false,
        status: 422,
        errorCode: "KYC_REQUIRED_FIELDS_MISSING",
        error: `${field} is required`,
        field,
      };
    }
  }

  if (entityType === "CNPJ") {
    const pjFields: Array<[keyof DispatchKycEmailBody, string]> = [
      ["razao_social", "razao_social"],
      ["nome_fantasia", "nome_fantasia"],
      ["legal_rep_full_name", "legal_rep_full_name"],
      ["legal_rep_cpf", "legal_rep_cpf"],
      ["legal_rep_phone", "legal_rep_phone"],
    ];

    for (const [field] of pjFields) {
      if (!isNonEmpty(body[field])) {
        return {
          ok: false,
          status: 422,
          errorCode: "KYC_REQUIRED_FIELDS_MISSING",
          error: `${field} is required for CNPJ`,
          field,
        };
      }
    }

    const legalRepCpf = digitsOnly(String(body.legal_rep_cpf));
    if (legalRepCpf.length !== CPF_LENGTH) {
      return {
        ok: false,
        status: 422,
        errorCode: "INVALID_DOCUMENT",
        error: "CPF do representante inválido",
        field: "legal_rep_cpf",
      };
    }
  }

  return {
    ok: true,
    body: {
      entity_type: entityType,
      full_name: String(body.full_name).trim(),
      document,
      phone: digitsOnly(String(body.phone)),
      email: String(body.email).trim().toLowerCase(),
      bank_institution_code: String(body.bank_institution_code).trim(),
      bank_branch: String(body.bank_branch).trim(),
      bank_account: String(body.bank_account).trim(),
      pix_key: isNonEmpty(body.pix_key) ? String(body.pix_key).trim() : undefined,
      razao_social: isNonEmpty(body.razao_social)
        ? String(body.razao_social).trim()
        : undefined,
      nome_fantasia: isNonEmpty(body.nome_fantasia)
        ? String(body.nome_fantasia).trim()
        : undefined,
      legal_rep_full_name: isNonEmpty(body.legal_rep_full_name)
        ? String(body.legal_rep_full_name).trim()
        : undefined,
      legal_rep_cpf: isNonEmpty(body.legal_rep_cpf)
        ? digitsOnly(String(body.legal_rep_cpf))
        : undefined,
      legal_rep_phone: isNonEmpty(body.legal_rep_phone)
        ? digitsOnly(String(body.legal_rep_phone))
        : undefined,
    },
  };
}

export function entityTypeFromDb(entityType: "pf" | "pj"): KycEntityType {
  return entityType === "pj" ? "CNPJ" : "CPF";
}
