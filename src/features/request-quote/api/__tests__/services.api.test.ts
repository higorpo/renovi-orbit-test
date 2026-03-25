import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServiceBySlug, getServiceById, listServicesForRequestQuote } from "../services.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const fromMock = vi.mocked(supabase.from);

let terminalResult: { data: unknown; error: { message: string } | null } | null = null;

function makeChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(terminalResult).then(onFulfilled);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalResult = null;
  fromMock.mockReturnValue(makeChain() as never);
});

describe("getServiceBySlug", () => {
  it("returns service on success", async () => {
    const service = { id: "svc-1", slug: "eletricista", title: "Eletricista" };
    terminalResult = { data: service, error: null };

    const result = await getServiceBySlug("eletricista");
    expect(result.service).toEqual(service);
    expect(result.error).toBeNull();
  });

  it("returns null when not found", async () => {
    terminalResult = { data: null, error: null };

    const result = await getServiceBySlug("unknown");
    expect(result.service).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns error on DB failure", async () => {
    terminalResult = { data: null, error: { message: "DB error" } };

    const result = await getServiceBySlug("eletricista");
    expect(result.service).toBeNull();
    expect(result.error).toBe("DB error");
  });
});

describe("getServiceById", () => {
  it("returns service on success", async () => {
    const service = { id: "svc-1", slug: "eletricista" };
    terminalResult = { data: service, error: null };

    const result = await getServiceById("svc-1");
    expect(result.service).toEqual(service);
    expect(result.error).toBeNull();
  });

  it("returns error on DB failure", async () => {
    terminalResult = { data: null, error: { message: "Not found" } };

    const result = await getServiceById("svc-1");
    expect(result.error).toBe("Not found");
  });
});

describe("listServicesForRequestQuote", () => {
  it("returns flat services when no children", async () => {
    const services = [
      { id: "svc-1", parent_id: null, slug: "eletricista", title: "Eletricista", show_on_request_quote: true },
      { id: "svc-2", parent_id: null, slug: "hidraulica", title: "Hidráulica", show_on_request_quote: true },
    ];
    terminalResult = { data: services, error: null };

    const result = await listServicesForRequestQuote();
    expect(result.services).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it("builds tree with children", async () => {
    const services = [
      { id: "parent-1", parent_id: null, slug: "eletrica", title: "Elétrica" },
      { id: "child-1", parent_id: "parent-1", slug: "instalacao", title: "Instalação" },
    ];
    terminalResult = { data: services, error: null };

    const result = await listServicesForRequestQuote();
    expect(result.services).toHaveLength(1);
    expect(result.services[0].children).toHaveLength(1);
    expect(result.services[0].children![0].id).toBe("child-1");
  });

  it("returns empty array on DB error", async () => {
    terminalResult = { data: null, error: { message: "List failed" } };

    const result = await listServicesForRequestQuote();
    expect(result.services).toEqual([]);
    expect(result.error).toBe("List failed");
  });

  it("returns empty array when data is null", async () => {
    terminalResult = { data: null, error: null };

    const result = await listServicesForRequestQuote();
    expect(result.services).toEqual([]);
  });
});
