import { assertEquals } from "std/testing/asserts";
import {
  buildCredenciamentoEmailHtml,
  buildCredenciamentoEmailSubject,
} from "../buildCredenciamentoEmailHtml.ts";
import type { ProviderKycContext } from "../types.ts";

const baseContext: ProviderKycContext = {
  providerId: "provider-1",
  gatewayAccount: {
    id: "acc-1",
    provider_id: "provider-1",
    document: "39053344705",
    onboarding_status: "DOCUMENTS_SUBMITTED",
    email_dispatched_at: null,
  },
  profile: {
    fullName: "João Silva",
    phone: "48999999999",
    email: "joao@example.com",
  },
  privateProfile: {
    entityType: "pf",
    cpf: "39053344705",
    cnpj: null,
    razaoSocial: null,
    nomeFantasia: null,
    legalRepresentativeName: null,
    legalRepresentativeCpf: null,
    legalRepresentativePhone: null,
    bankInstitutionCode: "001",
    bankBranch: "1234",
    bankAccount: "56789-0",
    pixKey: "joao@example.com",
    identityDocStoragePath: "providers/provider-1/kyc/identity/document.pdf",
    addressProofStoragePath: "providers/provider-1/kyc/address-proof/document.pdf",
    corporateCharterStoragePath: null,
    legalRepDocStoragePath: null,
  },
};

Deno.test("buildCredenciamentoEmailSubject includes provider name for PF", () => {
  assertEquals(
    buildCredenciamentoEmailSubject(baseContext),
    "[Renovi] Credenciamento prestador — João Silva",
  );
});

Deno.test("buildCredenciamentoEmailHtml includes banking and identity fields", () => {
  const html = buildCredenciamentoEmailHtml(baseContext);

  assertEquals(html.includes("João Silva"), true);
  assertEquals(html.includes("390.533.447-05"), true);
  assertEquals(html.includes("001"), true);
  assertEquals(html.includes("joao@example.com"), true);
});

Deno.test("buildCredenciamentoEmailHtml includes PJ representative fields", () => {
  const html = buildCredenciamentoEmailHtml({
    ...baseContext,
    gatewayAccount: {
      ...baseContext.gatewayAccount,
      document: "12345678000190",
    },
    privateProfile: {
      ...baseContext.privateProfile,
      entityType: "pj",
      razaoSocial: "Empresa LTDA",
      nomeFantasia: "Empresa",
      legalRepresentativeName: "Maria Souza",
      legalRepresentativeCpf: "39053344705",
      legalRepresentativePhone: "48988887777",
      corporateCharterStoragePath: "providers/provider-1/kyc/corporate-charter/document.pdf",
      legalRepDocStoragePath: "providers/provider-1/kyc/legal-rep-doc/document.pdf",
    },
  });

  assertEquals(html.includes("Empresa LTDA"), true);
  assertEquals(html.includes("Maria Souza"), true);
  assertEquals(html.includes("contrato social"), true);
});
