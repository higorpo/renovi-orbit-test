import { assertEquals } from "std/testing/asserts";
import {
  entityTypeFromDb,
  isRetryOnlyDispatchBody,
  validateDispatchKycEmailBody,
} from "../validateRequest.ts";

Deno.test("validateDispatchKycEmailBody accepts valid CPF payload", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CPF",
    full_name: "João Silva",
    document: "390.533.447-05",
    phone: "(48) 99999-9999",
    email: "joao@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.body.document, "39053344705");
    assertEquals(result.body.email, "joao@example.com");
  }
});

Deno.test("validateDispatchKycEmailBody rejects invalid CPF", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CPF",
    full_name: "João Silva",
    document: "123",
    phone: "48999999999",
    email: "joao@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.errorCode, "INVALID_DOCUMENT");
    assertEquals(result.field, "document");
  }
});

Deno.test("validateDispatchKycEmailBody requires PJ fields for CNPJ", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CNPJ",
    full_name: "Empresa LTDA",
    document: "12.345.678/0001-90",
    phone: "48999999999",
    email: "empresa@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.errorCode, "KYC_REQUIRED_FIELDS_MISSING");
    assertEquals(result.field, "razao_social");
  }
});

Deno.test("validateDispatchKycEmailBody accepts retry_only shortcut", () => {
  const result = validateDispatchKycEmailBody({ retry_only: true });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.body.retry_only, true);
  }
});

Deno.test("validateDispatchKycEmailBody rejects non-object body", () => {
  const result = validateDispatchKycEmailBody(null);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.errorCode, "KYC_REQUIRED_FIELDS_MISSING");
  }
});

Deno.test("validateDispatchKycEmailBody accepts valid CNPJ payload", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CNPJ",
    full_name: "Empresa LTDA",
    document: "11222333000181",
    phone: "48999999999",
    email: "empresa@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
    razao_social: "Empresa LTDA",
    nome_fantasia: "Empresa",
    legal_rep_full_name: "Rep",
    legal_rep_cpf: "390.533.447-05",
    legal_rep_phone: "48988887777",
    pix_key: "pix@example.com",
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.body.entity_type, "CNPJ");
    assertEquals(result.body.legal_rep_cpf, "39053344705");
    assertEquals(result.body.pix_key, "pix@example.com");
  }
});

Deno.test("validateDispatchKycEmailBody rejects invalid legal_rep_cpf", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CNPJ",
    full_name: "Empresa LTDA",
    document: "11222333000181",
    phone: "48999999999",
    email: "empresa@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
    razao_social: "Empresa LTDA",
    nome_fantasia: "Empresa",
    legal_rep_full_name: "Rep",
    legal_rep_cpf: "123",
    legal_rep_phone: "48988887777",
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.field, "legal_rep_cpf");
  }
});

Deno.test("isRetryOnlyDispatchBody detects retry_only flag", () => {
  assertEquals(isRetryOnlyDispatchBody({ retry_only: true }), true);
  assertEquals(isRetryOnlyDispatchBody({}), false);
  assertEquals(isRetryOnlyDispatchBody(null), false);
});

Deno.test("entityTypeFromDb maps pf and pj", () => {
  assertEquals(entityTypeFromDb("pf"), "CPF");
  assertEquals(entityTypeFromDb("pj"), "CNPJ");
});

Deno.test("validateDispatchKycEmailBody rejects missing entity_type", () => {
  const result = validateDispatchKycEmailBody({
    full_name: "João Silva",
    document: "39053344705",
    phone: "48999999999",
    email: "joao@example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.field, "entity_type");
    assertEquals(result.status, 422);
  }
});

Deno.test("validateDispatchKycEmailBody rejects missing required CPF field", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CPF",
    full_name: "João Silva",
    document: "39053344705",
    phone: "48999999999",
    email: "",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.field, "email");
    assertEquals(result.errorCode, "KYC_REQUIRED_FIELDS_MISSING");
  }
});

Deno.test("validateDispatchKycEmailBody omits empty optional CPF fields", () => {
  const result = validateDispatchKycEmailBody({
    entity_type: "CPF",
    full_name: " João Silva ",
    document: "39053344705",
    phone: "(48) 99999-9999",
    email: "Joao@Example.com",
    bank_institution_code: "001",
    bank_branch: "1234",
    bank_account: "56789-0",
    pix_key: "  ",
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.body.full_name, "João Silva");
    assertEquals(result.body.email, "joao@example.com");
    assertEquals(result.body.pix_key, undefined);
    assertEquals(result.body.razao_social, undefined);
  }
});

Deno.test("isRetryOnlyDispatchBody rejects non-true retry_only", () => {
  assertEquals(isRetryOnlyDispatchBody({ retry_only: false }), false);
  assertEquals(isRetryOnlyDispatchBody("x"), false);
});
