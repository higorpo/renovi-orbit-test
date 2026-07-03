import { assertEquals } from "std/testing/asserts";
import { validateDispatchKycEmailBody } from "../validateRequest.ts";

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
