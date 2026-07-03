import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchKycEmail, shouldBlockProviderForKyc } from "../kyc.api";
import { PAYMENT_EDGE } from "../payments.edge";

const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
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
  identityDocUrl: "https://example.com/id.pdf",
  addressProofUrl: "https://example.com/address.pdf",
};

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
