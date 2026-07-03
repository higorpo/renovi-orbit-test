import { assertEquals } from "std/testing/asserts";
import {
  handleDispatchKycEmailRequest,
  type DispatchKycEmailDeps,
} from "../handleRequest.ts";
import type { ProviderGatewayAccountRow, ProviderKycContext } from "../types.ts";

const cpfBody = {
  entity_type: "CPF",
  full_name: "João Silva",
  document: "39053344705",
  phone: "48999999999",
  email: "joao@example.com",
  bank_institution_code: "001",
  bank_branch: "1234",
  bank_account: "56789-0",
};

const gatewayAccount: ProviderGatewayAccountRow = {
  id: "acc-1",
  provider_id: "provider-1",
  document: "39053344705",
  onboarding_status: "DOCUMENTS_SUBMITTED",
  email_dispatched_at: null,
};

const kycContext: ProviderKycContext = {
  providerId: "provider-1",
  gatewayAccount,
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
    pixKey: null,
    identityDocStoragePath: "providers/provider-1/kyc/identity/document.pdf",
    addressProofStoragePath: "providers/provider-1/kyc/address-proof/document.pdf",
    corporateCharterStoragePath: null,
    legalRepDocStoragePath: null,
  },
};

function authRequest(body: unknown): Request {
  return new Request("https://example.com/dispatch-kyc-email", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createDeps(overrides: Partial<DispatchKycEmailDeps> = {}): DispatchKycEmailDeps {
  return {
    getUser: async () => ({
      user: { id: "provider-1", email: "joao@example.com" },
      error: null,
    }),
    loadGatewayAccount: async () => gatewayAccount,
    loadProviderKycContext: async () => kycContext,
    downloadStorageObject: async () => ({
      data: new Blob(["pdf-content"], { type: "application/pdf" }),
      error: null,
    }),
    sendCredenciamentoEmail: async () => ({
      ok: true,
      vendorMessageId: "resend-msg-1",
    }),
    markEmailDispatched: async () => {},
    ingestProviderKycSubmitted: async () => {},
    resolveCredenciamentoRecipientEmail: () => "credenciamento@netcred.com.br",
    checkRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
    ...overrides,
  };
}

Deno.test("missing auth returns 401", async () => {
  const response = await handleDispatchKycEmailRequest(
    new Request("https://example.com/dispatch-kyc-email", {
      method: "POST",
      body: JSON.stringify(cpfBody),
    }),
    createDeps(),
  );

  assertEquals(response.status, 401);
});

Deno.test("invalid document returns 422", async () => {
  const response = await handleDispatchKycEmailRequest(
    authRequest({ ...cpfBody, document: "123" }),
    createDeps(),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error_code, "INVALID_DOCUMENT");
});

Deno.test("successful dispatch marks email and ingests provider notification", async () => {
  let marked = false;
  let notified = false;

  const response = await handleDispatchKycEmailRequest(
    authRequest(cpfBody),
    createDeps({
      markEmailDispatched: async () => {
        marked = true;
      },
      ingestProviderKycSubmitted: async () => {
        notified = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(marked, true);
  assertEquals(notified, true);

  const body = await response.json();
  assertEquals(body, {
    submission_id: "acc-1",
    email_dispatched: true,
    email_pending: false,
  });
});

Deno.test("already dispatched returns idempotent success and retries notification ingest", async () => {
  let notified = false;

  const response = await handleDispatchKycEmailRequest(
    authRequest(cpfBody),
    createDeps({
      loadGatewayAccount: async () => ({
        ...gatewayAccount,
        email_dispatched_at: "2026-07-01T00:00:00.000Z",
      }),
      ingestProviderKycSubmitted: async () => {
        notified = true;
      },
      sendCredenciamentoEmail: async () => {
        throw new Error("should not send when already dispatched");
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(notified, true);
});

Deno.test("resend failure preserves email_pending", async () => {
  const response = await handleDispatchKycEmailRequest(
    authRequest(cpfBody),
    createDeps({
      sendCredenciamentoEmail: async () => ({
        ok: false,
        errorCode: "resend_send_failed",
        errorMessage: "Resend unavailable",
      }),
    }),
  );

  assertEquals(response.status, 502);
  const body = await response.json();
  assertEquals(body.error_code, "CREDENCIAMENTO_EMAIL_FAILED");
  assertEquals(body.email_pending, true);
});

Deno.test("retry_only skips document validation and dispatches from DB context", async () => {
  let notified = false;

  const response = await handleDispatchKycEmailRequest(
    authRequest({ retry_only: true }),
    createDeps({
      ingestProviderKycSubmitted: async () => {
        notified = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(notified, true);
});

Deno.test("email mismatch with auth user returns 403", async () => {
  const response = await handleDispatchKycEmailRequest(
    authRequest({ ...cpfBody, email: "other@example.com" }),
    createDeps(),
  );

  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.error_code, "FORBIDDEN");
});
