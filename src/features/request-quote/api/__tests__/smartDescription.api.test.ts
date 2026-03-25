import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeGenerateSmartDescription } from "../smartDescription.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const invokeMock = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invokeGenerateSmartDescription", () => {
  const payload = {
    serviceId: "svc-1",
    serviceTitle: "Eletricista",
    userDescription: "Lights are flickering",
    formData: {},
  };

  it("returns data on success", async () => {
    const responseData = { description: "Smart description", tags: ["elétrica"] };
    invokeMock.mockResolvedValue({ data: responseData, error: null });

    const result = await invokeGenerateSmartDescription(payload);
    expect(result.data).toEqual(responseData);
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    const error = new Error("Function invocation failed");
    invokeMock.mockResolvedValue({ data: null, error });

    const result = await invokeGenerateSmartDescription(payload);
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Function invocation failed");
  });

  it("returns null data when response is null", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });

    const result = await invokeGenerateSmartDescription(payload);
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("passes payload fields to the function invocation", async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null });

    await invokeGenerateSmartDescription(payload);
    expect(invokeMock).toHaveBeenCalledWith("generate-smart-description", {
      body: payload,
    });
  });
});
