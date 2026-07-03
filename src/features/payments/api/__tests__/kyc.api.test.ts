import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchKycEmail, submitProviderKyc, shouldBlockProviderForKyc } from "../kyc.api";
import { PAYMENT_EDGE } from "../payments.edge";
import { PAYMENT_RPC } from "../payments.rpc";

const mockInvoke = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

const baseRequest = {
  entityType: "CPF" as const,
  fullName: "João Silva",
  document: "390.533.447-05",
  phone: "(48) 99999-9999",
  email: "joao@example.com",
  bankInstitutionCode: "001",
  bankBranch: "1234",
  bankAccount: "56789-0",
  identityDocStoragePath: "provider-1/identity/document.pdf",
  addressProofStoragePath: "provider-1/address-proof/document.pdf",
  identityDocUrl: "https://example.com/id.pdf",
  addressProofUrl: "https://example.com/address.pdf",
};

describe("submitProviderKyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists KYC via payment_submit_provider_kyc RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        provider_gateway_account_id: "acc-1",
        onboarding_status: "DOCUMENTS_SUBMITTED",
        dispatch_kyc_email_required: true,
      },
      error: null,
    });

    const result = await submitProviderKyc({
      bankInstitutionCode: "001",
      bankBranch: "1234",
      bankAccount: "56789-0",
      identityDocStoragePath: "provider-1/identity/document.pdf",
      addressProofStoragePath: "provider-1/address-proof/document.pdf",
      phone: "48999999999",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      providerGatewayAccountId: "acc-1",
      onboardingStatus: "DOCUMENTS_SUBMITTED",
      dispatchKycEmailRequired: true,
    });
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.submitProviderKyc, {
      p_bank_institution_code: "001",
      p_bank_branch: "1234",
      p_bank_account: "56789-0",
      p_identity_doc_storage_path: "provider-1/identity/document.pdf",
      p_address_proof_storage_path: "provider-1/address-proof/document.pdf",
      p_pix_key: undefined,
      p_phone: "48999999999",
      p_legal_representative_phone: undefined,
      p_corporate_charter_storage_path: undefined,
      p_legal_rep_doc_storage_path: undefined,
    });
  });
});

describe("dispatchKycEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns submission result on successful edge invoke", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        submission_id: "sub-1",
        email_dispatched: true,
        email_pending: false,
      },
      error: null,
    });

    const result = await dispatchKycEmail(baseRequest);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      submissionId: "sub-1",
      emailDispatched: true,
      emailPending: false,
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      PAYMENT_EDGE.dispatchKycEmail,
      expect.objectContaining({
        body: expect.objectContaining({
          entity_type: "CPF",
          document: "39053344705",
        }),
      }),
    );
  });

  it("maps edge validation errors", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        error_code: "INVALID_DOCUMENT",
        error: "Documento inválido",
        field: "document",
      },
      error: null,
    });

    const result = await dispatchKycEmail(baseRequest);

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("INVALID_DOCUMENT");
    expect(result.field).toBe("document");
  });
});

describe("shouldBlockProviderForKyc", () => {
  it("blocks when account is missing or pending documents", () => {
    expect(shouldBlockProviderForKyc(null)).toBe(true);
    expect(shouldBlockProviderForKyc({
      id: "acc-1",
      onboardingStatus: "PENDING_DOCUMENTS",
      emailDispatchedAt: null,
      onboardingSubmittedAt: null,
    })).toBe(true);
  });

  it("allows active onboarding status", () => {
    expect(shouldBlockProviderForKyc({
      id: "acc-1",
      onboardingStatus: "ACTIVE",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
    })).toBe(false);
  });
});
