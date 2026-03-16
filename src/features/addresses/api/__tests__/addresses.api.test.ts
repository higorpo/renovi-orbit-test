import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../addresses.api";
import type { ClientAddressWithRelations } from "../../types/addresses.types";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

const supabase = await import("@/lib/supabase/client").then((m) => m.supabase);
const from = vi.mocked(supabase.from);

/** Queue of results to return when the chain is awaited (one per await in the API). */
let terminalReturns: Promise<{ data: unknown; error: { message: string } | null }>[] = [];

function makeChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };
  const thenable = {
    ...chain,
    then(onFulfilled: (v: { data: unknown; error: { message: string } | null }) => unknown) {
      const p = terminalReturns.shift();
      return Promise.resolve(p).then(onFulfilled);
    },
  };
  return thenable;
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalReturns = [];
  from.mockReturnValue(makeChain() as never);
});

describe("listAddresses", () => {
  it("returns addresses and null error on success", async () => {
    const rows: ClientAddressWithRelations[] = [
      {
        id: "addr-1",
        client_id: "user-1",
        street: "Rua A",
        number: "1",
        neighborhood: "Centro",
        platform_cities: { name: "São Paulo" },
        platform_states: { abbreviation: "SP" },
      } as ClientAddressWithRelations,
    ];
    terminalReturns = [Promise.resolve({ data: rows, error: null })];

    const result = await listAddresses("user-1");

    expect(result.addresses).toEqual(rows);
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith("client_addresses");
  });

  it("returns empty array and error on failure", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: { message: "DB error" } })];

    const result = await listAddresses("user-1");

    expect(result.addresses).toEqual([]);
    expect(result.error).toBe("DB error");
  });
});

describe("createAddress", () => {
  it("returns address and null error on success when not default", async () => {
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }),
    ];

    const result = await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
    });

    expect(result.address).toBeDefined();
    expect(result.address?.id).toBe("new-id");
    expect(result.error).toBeNull();
  });

  it("returns address and null error when is_default true (clearOtherDefaults then insert)", async () => {
    terminalReturns = [
      Promise.resolve({ data: null, error: null }), // clearOtherDefaults .eq()
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }), // insert .single()
    ];

    const result = await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
      is_default: true,
    });

    expect(result.address).toBeDefined();
    expect(result.error).toBeNull();
  });

  it("returns error when insert fails", async () => {
    terminalReturns = [
      Promise.resolve({ data: null, error: { message: "Insert failed" } }),
    ];

    const result = await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
    });

    expect(result.address).toBeNull();
    expect(result.error).toBe("Insert failed");
  });
});

describe("updateAddress", () => {
  it("returns null error on success", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    const result = await updateAddress("addr-1", "user-1", { street: "Rua Nova" });

    expect(result.error).toBeNull();
  });

  it("returns error when update fails", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: { message: "Update failed" } })];

    const result = await updateAddress("addr-1", "user-1", { street: "Rua Nova" });

    expect(result.error).toBe("Update failed");
  });
});

describe("deleteAddress", () => {
  it("returns null error and soft-deletes", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    const result = await deleteAddress("addr-1", "user-1");

    expect(result.error).toBeNull();
  });
});
