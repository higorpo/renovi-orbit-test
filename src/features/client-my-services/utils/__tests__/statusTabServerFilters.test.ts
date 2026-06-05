import { describe, expect, it, vi } from "vitest";
import {
  applyStatusTabServerFilter,
  buildContractedServiceEmbed,
  shouldUseContractedServiceInnerJoin,
} from "../statusTabServerFilters";

function makeQuery() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query = {
    eq: vi.fn((...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return query;
    }),
    neq: vi.fn((...args: unknown[]) => {
      calls.push({ method: "neq", args });
      return query;
    }),
    or: vi.fn((...args: unknown[]) => {
      calls.push({ method: "or", args });
      return query;
    }),
    calls,
  };
  return query;
}

describe("shouldUseContractedServiceInnerJoin", () => {
  it("uses inner join for tabs that filter by contracted service status", () => {
    expect(shouldUseContractedServiceInnerJoin("in_progress")).toBe(true);
    expect(shouldUseContractedServiceInnerJoin("completed")).toBe(true);
    expect(shouldUseContractedServiceInnerJoin("negotiation")).toBe(false);
    expect(shouldUseContractedServiceInnerJoin("cancelled")).toBe(false);
    expect(shouldUseContractedServiceInnerJoin(null)).toBe(false);
  });
});

describe("buildContractedServiceEmbed", () => {
  it("adds !inner for in_progress and completed tabs", () => {
    expect(buildContractedServiceEmbed("in_progress")).toContain("services!inner!");
    expect(buildContractedServiceEmbed("completed")).toContain("services!inner!");
    expect(buildContractedServiceEmbed("negotiation")).toContain("services!service_requests_contracted_service_id_fkey");
    expect(buildContractedServiceEmbed("negotiation")).not.toContain("services!inner!");
  });
});

describe("applyStatusTabServerFilter", () => {
  it("does not filter when phase is null", () => {
    const query = makeQuery();
    applyStatusTabServerFilter(query, null);
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.neq).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
  });

  it("filters negotiation tab by OPEN status", () => {
    const query = makeQuery();
    applyStatusTabServerFilter(query, "negotiation");
    expect(query.calls).toEqual([{ method: "eq", args: ["status", "OPEN"] }]);
  });

  it("filters in_progress tab by COMPLETED SR and non-terminal service", () => {
    const query = makeQuery();
    applyStatusTabServerFilter(query, "in_progress");
    expect(query.calls).toEqual([
      { method: "eq", args: ["status", "COMPLETED"] },
      { method: "neq", args: ["services.status", "COMPLETED"] },
      { method: "neq", args: ["services.status", "CANCELLED"] },
    ]);
  });

  it("filters completed tab by COMPLETED SR and COMPLETED service", () => {
    const query = makeQuery();
    applyStatusTabServerFilter(query, "completed");
    expect(query.calls).toEqual([
      { method: "eq", args: ["status", "COMPLETED"] },
      { method: "eq", args: ["services.status", "COMPLETED"] },
    ]);
  });

  it("does not apply PostgREST or filter for cancelled tab (ids come from RPC)", () => {
    const query = makeQuery();
    applyStatusTabServerFilter(query, "cancelled");
    expect(query.calls).toEqual([]);
  });
});
