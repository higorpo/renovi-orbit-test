import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProviderSentBudgets } from "../providerBudgets.api";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("providerBudgets.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchProviderSentBudgets", () => {
    it("returns paginated data when RPC succeeds", async () => {
      const payload = {
        items: [{ id: "p1" }],
        total_count: 1,
        page: 1,
        page_size: 20,
      };
      rpc.mockResolvedValue({ data: payload, error: null });

      const result = await fetchProviderSentBudgets({
        page: 1,
        pageSize: 20,
        status: "submitted",
        search: "foo",
      });

      expect(rpc).toHaveBeenCalledWith("list_provider_sent_budgets", {
        p_page: 1,
        p_page_size: 20,
        p_status: "submitted",
        p_search: "foo",
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual(payload);
    });

    it("returns error when RPC fails", async () => {
      rpc.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });

      const result = await fetchProviderSentBudgets({
        page: 2,
        pageSize: 10,
        status: null,
        search: null,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe("permission denied");
    });

    it("returns error when response shape is invalid", async () => {
      rpc.mockResolvedValue({ data: { items: "nope" }, error: null });

      const result = await fetchProviderSentBudgets({
        page: 1,
        pageSize: 20,
        status: null,
        search: null,
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe("Unexpected response from server");
    });
  });
});
