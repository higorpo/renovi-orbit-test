import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequestQuoteOrder } from "../createRequestQuoteOrder.api";
import type { CreateRequestQuoteOrderParams } from "../createRequestQuoteOrder.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {},
  getSupabaseAnonKey: vi.fn().mockReturnValue("anon-key"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

const mockSession = { access_token: "user-token" } as never;

function makeParams(overrides: Partial<CreateRequestQuoteOrderParams> = {}): CreateRequestQuoteOrderParams {
  return {
    userId: "user-1",
    email: "user@example.com",
    recaptchaToken: "recaptcha-token",
    step4Data: { kind: "existing", addressId: "addr-1" },
    step3Data: {
      description: "I need help",
      photos: [],
    },
    selectedService: {
      id: "svc-1",
      title: "Eletricista",
    } as never,
    step2Data: { field: "value" },
    step2FormSchema: null,
    step2FormVersion: null,
    session: mockSession,
    ...overrides,
  };
}

describe("createRequestQuoteOrder", () => {
  it("returns success with requestId on 200 response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ requestId: "req-123", addressId: "addr-1" }),
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.requestId).toBe("req-123");
      expect(result.addressId).toBe("addr-1");
    }
  });

  it("returns error when step4Data is null", async () => {
    const result = await createRequestQuoteOrder(makeParams({ step4Data: null as never }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("endereço");
    }
  });

  it("returns rate limit error on 429", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: vi.fn().mockReturnValue("30") },
      json: vi.fn().mockResolvedValue({ message: "Muitas requisições." }),
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("requisições");
      expect(result.retryAfter).toBe(30);
    }
  });

  it("returns payload too large error on 413", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({}),
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Arquivos muito grandes");
    }
  });

  it("returns API error on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ error: "Server error" }),
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Server error");
    }
  });

  it("returns generic error when error message is not a string", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({}),
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Ocorreu um erro. Tente novamente.");
    }
  });

  it("returns invalid response error when requestId is missing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ addressId: "addr-1" }), // no requestId
    });

    const result = await createRequestQuoteOrder(makeParams());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Resposta inválida do servidor.");
    }
  });

  it("uses anon key when session is null", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ requestId: "req-1", addressId: null }),
    });

    await createRequestQuoteOrder(makeParams({ session: null }));
    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe("Bearer anon-key");
  });

  it("builds formData for new address kind", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ requestId: "req-1", addressId: null }),
    });

    const step4Data = {
      kind: "new" as const,
      formData: { street: "Rua A", number: "10", neighborhood: "Centro", cityId: "city-1", stateId: "state-1", zipCode: "01310100" },
      location: { lat: -23.55, lng: -46.63 },
    };

    const result = await createRequestQuoteOrder(
      makeParams({ step4Data: step4Data as unknown as CreateRequestQuoteOrderParams["step4Data"] }),
    );
    expect(result.success).toBe(true);
  });

  it("includes photos in formData", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: vi.fn().mockResolvedValue({ requestId: "req-1", addressId: null }),
    });

    const photo = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const result = await createRequestQuoteOrder(
      makeParams({ step3Data: { description: "desc", photos: [photo] } })
    );
    expect(result.success).toBe(true);
  });
});
