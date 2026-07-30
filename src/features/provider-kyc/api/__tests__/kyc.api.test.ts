// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createKycUploadSession,
  dispatchKycEmail,
  fetchProviderPaymentAccount,
  fetchProviderPrivateProfileForKyc,
  isProviderCredentialed,
  isProviderKycAwaitingReview,
  isProviderKycDocumentsSubmitted,
  isProviderKycPending,
  isProviderKycRejected,
  isProviderKycSubmitting,
  isProviderKycSuspended,
  registerKycUploadPath,
  retryProviderKycEmailDispatch,
  shouldBlockProviderForKyc,
  submitProviderKyc,
  uploadKycDocument,
  validateKycDocumentFile,
} from "../kyc.api";
import { PROVIDER_KYC_EDGE, PROVIDER_KYC_RPC } from "../providerKyc.rpc";

const mockInvoke = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
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

  it("persists KYC via payment_submit_provider_kyc RPC with identity args", async () => {
    mockRpc.mockResolvedValue({
      data: {
        provider_gateway_account_id: "acc-1",
        onboarding_status: "DOCUMENTS_SUBMITTED",
        dispatch_kyc_email_required: true,
      },
      error: null,
    });

    const result = await submitProviderKyc({
      entityType: "CPF",
      document: "390.533.447-05",
      fullName: "João Silva",
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
    expect(mockRpc).toHaveBeenCalledWith(PROVIDER_KYC_RPC.submitProviderKyc, {
      p_bank_institution_code: "001",
      p_bank_branch: "1234",
      p_bank_account: "56789-0",
      p_identity_doc_storage_path: "provider-1/identity/document.pdf",
      p_address_proof_storage_path: "provider-1/address-proof/document.pdf",
      p_entity_type: "pf",
      p_document: "39053344705",
      p_pix_key: undefined,
      p_phone: "48999999999",
      p_full_name: "João Silva",
      p_legal_representative_phone: undefined,
      p_corporate_charter_storage_path: undefined,
      p_legal_rep_doc_storage_path: undefined,
      p_razao_social: undefined,
      p_nome_fantasia: undefined,
      p_legal_representative_name: undefined,
      p_legal_representative_cpf: undefined,
    });
  });

  it("maps CNPJ entity type to pj and passes PJ identity fields", async () => {
    mockRpc.mockResolvedValue({
      data: {
        provider_gateway_account_id: "acc-2",
        onboarding_status: "DOCUMENTS_SUBMITTED",
        dispatch_kyc_email_required: true,
      },
      error: null,
    });

    await submitProviderKyc({
      entityType: "CNPJ",
      document: "11.444.777/0001-61",
      fullName: "Empresa LTDA",
      bankInstitutionCode: "001",
      bankBranch: "1234",
      bankAccount: "56789-0",
      identityDocStoragePath: "a",
      addressProofStoragePath: "b",
      razaoSocial: "Empresa LTDA",
      nomeFantasia: "Empresa",
      legalRepresentativeName: "Maria",
      legalRepresentativeCpf: "390.533.447-05",
      legalRepresentativePhone: "48988887777",
      corporateCharterStoragePath: "c",
      legalRepDocStoragePath: "d",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      PROVIDER_KYC_RPC.submitProviderKyc,
      expect.objectContaining({
        p_entity_type: "pj",
        p_document: "11444777000161",
        p_razao_social: "Empresa LTDA",
        p_legal_representative_cpf: "39053344705",
        p_legal_rep_doc_storage_path: "d",
      }),
    );
  });

  it("maps RPC errors and invalid response payloads", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "INVALID_BANK", code: "INVALID_BANK" },
    });

    await expect(
      submitProviderKyc({
        entityType: "CPF",
        document: "390.533.447-05",
        bankInstitutionCode: "001",
        bankBranch: "1234",
        bankAccount: "56789-0",
        identityDocStoragePath: "a",
        addressProofStoragePath: "b",
      }),
    ).resolves.toMatchObject({
      data: null,
      errorCode: "INVALID_BANK",
    });

    mockRpc.mockResolvedValue({
      data: { provider_gateway_account_id: 123 },
      error: null,
    });

    await expect(
      submitProviderKyc({
        entityType: "CPF",
        document: "390.533.447-05",
        bankInstitutionCode: "001",
        bankBranch: "1234",
        bankAccount: "56789-0",
        identityDocStoragePath: "a",
        addressProofStoragePath: "b",
      }),
    ).resolves.toEqual({
      data: null,
      error: "invalid_submit_provider_kyc_response",
    });
  });
});

describe("upload sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createKycUploadSession returns session id and path prefix", async () => {
    mockRpc.mockResolvedValue({
      data: {
        upload_session_id: "session-1",
        document_key: "identity",
        status: "pending",
        storage_path_prefix: "providers/provider-1/kyc/identity/",
      },
      error: null,
    });

    const result = await createKycUploadSession("identity");

    expect(result).toEqual({
      uploadSessionId: "session-1",
      storagePathPrefix: "providers/provider-1/kyc/identity/",
      error: null,
    });
    expect(mockRpc).toHaveBeenCalledWith(PROVIDER_KYC_RPC.createUploadSession, {
      p_document_key: "identity",
    });
  });

  it("registerKycUploadPath registers storage path on session", async () => {
    mockRpc.mockResolvedValue({
      data: {
        upload_session_id: "session-1",
        document_key: "identity",
        storage_path: "providers/provider-1/kyc/identity/document.pdf",
        status: "pending",
      },
      error: null,
    });

    const result = await registerKycUploadPath(
      "session-1",
      "providers/provider-1/kyc/identity/document.pdf",
    );

    expect(result).toEqual({
      storagePath: "providers/provider-1/kyc/identity/document.pdf",
      error: null,
    });
    expect(mockRpc).toHaveBeenCalledWith(PROVIDER_KYC_RPC.registerUploadPath, {
      p_upload_session_id: "session-1",
      p_storage_path: "providers/provider-1/kyc/identity/document.pdf",
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
      PROVIDER_KYC_EDGE.dispatchKycEmail,
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

  it("normalizes CNPJ payload fields", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        submission_id: "sub-cnpj",
        email_dispatched: false,
        email_pending: true,
      },
      error: null,
    });

    const result = await dispatchKycEmail({
      ...baseRequest,
      entityType: "CNPJ",
      document: "11.444.777/0001-61",
      razaoSocial: "Empresa LTDA",
      nomeFantasia: "Empresa",
      legalRepFullName: "Maria",
      legalRepCpf: "390.533.447-05",
      legalRepPhone: "(48) 98888-7777",
      corporateCharterUrl: "https://example.com/charter.pdf",
      legalRepDocUrl: "https://example.com/rep.pdf",
    });

    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      expect.objectContaining({
        body: expect.objectContaining({
          entity_type: "CNPJ",
          document: "11444777000161",
          legal_rep_cpf: "39053344705",
        }),
      }),
    );
  });
});

describe("shouldBlockProviderForKyc", () => {
  it("blocks when account is missing", () => {
    expect(shouldBlockProviderForKyc(null)).toBe(true);
  });

  it("blocks any non-ACTIVE onboarding status", () => {
    for (const onboardingStatus of [
      "PENDING_DOCUMENTS",
      "DOCUMENTS_SUBMITTED",
      "UNDER_NETCRED_REVIEW",
      "REJECTED",
      "SUSPENDED",
    ]) {
      expect(shouldBlockProviderForKyc({
        id: "acc-1",
        onboardingStatus,
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      })).toBe(true);
    }
  });

  it("allows only ACTIVE onboarding status", () => {
    expect(shouldBlockProviderForKyc({
      id: "acc-1",
      onboardingStatus: "ACTIVE",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
    })).toBe(false);
    expect(isProviderCredentialed({
      id: "acc-1",
      onboardingStatus: "ACTIVE",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
    })).toBe(true);
  });
});

describe("validateKycDocumentFile", () => {
  it("rejects unsupported type and oversized files", () => {
    expect(
      validateKycDocumentFile(new File(["x"], "a.txt", { type: "text/plain" })),
    ).toMatch(/Formato não permitido/);

    const big = new File([new Uint8Array(51 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    expect(validateKycDocumentFile(big)).toMatch(/no máximo/);
  });

  it("accepts allowed document types", () => {
    expect(
      validateKycDocumentFile(new File(["x"], "a.pdf", { type: "application/pdf" })),
    ).toBeNull();
  });
});

describe("uploadKycDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error without uploading", async () => {
    const result = await uploadKycDocument(
      "provider-1",
      "identity",
      new File(["x"], "a.txt", { type: "text/plain" }),
    );

    expect(result.error).toMatch(/Formato não permitido/);
    expect(result.sessionId).toBeNull();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("creates session, uploads, registers path and returns signed URL", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: {
          upload_session_id: "session-1",
          document_key: "identity",
          storage_path_prefix: "providers/provider-1/kyc/identity/",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          upload_session_id: "session-1",
          storage_path: "providers/provider-1/kyc/identity/document.pdf",
        },
        error: null,
      });

    const upload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/doc.pdf" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ upload, createSignedUrl });

    const result = await uploadKycDocument(
      "provider-1",
      "identity",
      new File(["x"], "doc.pdf", { type: "application/pdf" }),
    );

    expect(result.error).toBeNull();
    expect(result.sessionId).toBe("session-1");
    expect(result.path).toContain("providers/provider-1/kyc/identity/");
    expect(result.signedUrl).toBe("https://signed.example/doc.pdf");
    expect(mockRpc).toHaveBeenNthCalledWith(1, PROVIDER_KYC_RPC.createUploadSession, {
      p_document_key: "identity",
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, PROVIDER_KYC_RPC.registerUploadPath, {
      p_upload_session_id: "session-1",
      p_storage_path: expect.stringContaining("providers/provider-1/kyc/identity/"),
    });
  });

  it("returns upload error from storage", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        upload_session_id: "session-1",
        storage_path_prefix: "providers/provider-1/kyc/identity/",
      },
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: "upload failed" } }),
      createSignedUrl: vi.fn(),
    });

    const result = await uploadKycDocument(
      "provider-1",
      "identity",
      new File(["x"], "doc.pdf", { type: "application/pdf" }),
    );

    expect(result).toEqual({
      path: null,
      signedUrl: null,
      sessionId: "session-1",
      error: "upload failed",
    });
  });

  it("returns signed URL generation failure after register", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: {
          upload_session_id: "session-1",
          storage_path_prefix: "providers/provider-1/kyc/identity/",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          upload_session_id: "session-1",
          storage_path: "providers/provider-1/kyc/identity/document.pdf",
        },
        error: null,
      });
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "signed url failed" },
      }),
    });

    const result = await uploadKycDocument(
      "provider-1",
      "identity",
      new File(["x"], "doc.unknown", { type: "application/pdf" }),
    );

    expect(result.path).toContain("document.pdf");
    expect(result.sessionId).toBe("session-1");
    expect(result.signedUrl).toBeNull();
    expect(result.error).toBe("signed url failed");
  });
});

describe("retryProviderKycEmailDispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dispatch result on success", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        submission_id: "sub-retry",
        email_dispatched: true,
        email_pending: false,
      },
      error: null,
    });

    const result = await retryProviderKycEmailDispatch();

    expect(result.error).toBeNull();
    expect(result.data?.submissionId).toBe("sub-retry");
    expect(mockInvoke).toHaveBeenCalledWith(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      expect.objectContaining({
        body: { retry_only: true },
      }),
    );
  });

  it("maps retry failures", async () => {
    mockInvoke.mockResolvedValue({
      data: { error_code: "RATE_LIMIT", error: "Aguarde" },
      error: null,
    });

    const result = await retryProviderKycEmailDispatch();

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("RATE_LIMIT");
  });
});

describe("fetchProviderPaymentAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps account row on success", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "acc-1",
          onboarding_status: "ACTIVE",
          email_dispatched_at: "2026-07-01T00:00:00.000Z",
          onboarding_submitted_at: "2026-06-30T00:00:00.000Z",
        },
        error: null,
      }),
    });

    const result = await fetchProviderPaymentAccount("provider-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: "acc-1",
      onboardingStatus: "ACTIVE",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
    });
  });

  it("returns null data when no account exists", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(fetchProviderPaymentAccount("provider-1")).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it("returns error on db failure", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "db error" },
      }),
    });

    await expect(fetchProviderPaymentAccount("provider-1")).resolves.toEqual({
      data: null,
      error: "db error",
    });
  });
});

describe("fetchProviderPrivateProfileForKyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps private profile for PF prefill", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          entity_type: "pf",
          cpf: "39053344705",
          cnpj: null,
          bank_institution_code: "001",
          bank_branch: "1234",
          bank_account: "56789-0",
          pix_key: null,
          razao_social: null,
          nome_fantasia: null,
          legal_representative_name: null,
          legal_representative_cpf: null,
          legal_representative_phone: null,
        },
        error: null,
      }),
    });

    const result = await fetchProviderPrivateProfileForKyc("provider-1");

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      entityType: "CPF",
      document: "39053344705",
      bankInstitutionCode: "001",
    });
  });
});

describe("kyc status helpers", () => {
  it("detects pending, submitting, review, rejected and suspended states", () => {
    expect(isProviderKycPending(null)).toBe(true);
    expect(isProviderKycPending({
      id: "a",
      onboardingStatus: "PENDING_DOCUMENTS",
      emailDispatchedAt: null,
      onboardingSubmittedAt: null,
    })).toBe(true);

    expect(isProviderKycSubmitting({
      id: "a",
      onboardingStatus: "DOCUMENTS_SUBMITTED",
      emailDispatchedAt: null,
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(true);

    expect(isProviderKycDocumentsSubmitted({
      id: "a",
      onboardingStatus: "DOCUMENTS_SUBMITTED",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(true);

    expect(isProviderKycSubmitting({
      id: "a",
      onboardingStatus: "DOCUMENTS_SUBMITTED",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(false);

    expect(isProviderKycAwaitingReview({
      id: "a",
      onboardingStatus: "UNDER_NETCRED_REVIEW",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(true);

    expect(isProviderKycRejected({
      id: "a",
      onboardingStatus: "REJECTED",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(true);

    expect(isProviderKycSuspended({
      id: "a",
      onboardingStatus: "SUSPENDED",
      emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
    })).toBe(true);
  });
});
