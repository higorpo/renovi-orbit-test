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

vi.mock("../../utils/h3", () => ({
  latLngToH3Index: vi.fn((lat: number, lng: number) =>
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && Number.isFinite(lat) && Number.isFinite(lng)
      ? "8f283082a9b1fff"
      : null
  ),
}));

const supabase = await import("@/lib/supabase/client").then((m) => m.supabase);
const from = vi.mocked(supabase.from);

/** Chain returned by makeChain(); used to assert insert/update call args. */
type MockChain = { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

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
    then(onFulfilled: (v: { data: unknown; error: { message: string } | null } | undefined) => unknown) {
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

  it("returns empty array when data is null without error", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    const result = await listAddresses("user-1");

    expect(result.addresses).toEqual([]);
    expect(result.error).toBeNull();
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

  it("returns clearOtherDefaults errors before inserting a default address", async () => {
    terminalReturns = [
      Promise.resolve({ data: null, error: { message: "clear failed" } }),
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

    expect(result.address).toBeNull();
    expect(result.error).toBe("clear failed");
  });

  it("includes h3_index in insert when latitude and longitude are provided", async () => {
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X", h3_index: "8f283082a9b1fff" },
        error: null,
      }),
    ];

    await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
      latitude: -23.55,
      longitude: -46.63,
    });

    const chain = from.mock.results[0]?.value as MockChain | undefined;
    const insertCall = chain?.insert.mock.calls[0]?.[0];
    expect(insertCall).toHaveProperty("h3_index", "8f283082a9b1fff");
    expect(insertCall).toHaveProperty("location");
  });

  it("omits location and h3_index when coordinates are missing", async () => {
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }),
    ];

    await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
    });

    const chain = from.mock.results[0]?.value as MockChain | undefined;
    const insertCall = chain?.insert.mock.calls[0]?.[0];
    expect(insertCall).not.toHaveProperty("location");
    expect(insertCall).not.toHaveProperty("h3_index");
    expect(insertCall).toMatchObject({ label: "Casa", complement: null });
  });

  it("omits location when latitude or longitude is non-finite", async () => {
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }),
    ];

    await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
      latitude: Number.NaN,
      longitude: -46.63,
    });

    const chain = from.mock.results[0]?.value as MockChain | undefined;
    const insertCall = chain?.insert.mock.calls[0]?.[0];
    expect(insertCall).not.toHaveProperty("location");
    expect(insertCall).not.toHaveProperty("h3_index");
  });

  it("omits h3_index when latLngToH3Index returns null", async () => {
    const { latLngToH3Index } = await import("../../utils/h3");
    vi.mocked(latLngToH3Index).mockReturnValueOnce(null);
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }),
    ];

    await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
      latitude: -23.55,
      longitude: -46.63,
    });

    const chain = from.mock.results[0]?.value as MockChain | undefined;
    const insertCall = chain?.insert.mock.calls[0]?.[0];
    expect(insertCall).toHaveProperty("location");
    expect(insertCall).not.toHaveProperty("h3_index");
  });

  it("records addresses.created metric on success", async () => {
    const { metrics } = await import("@/lib/sentry");
    terminalReturns = [
      Promise.resolve({
        data: { id: "new-id", client_id: "user-1", street: "Rua X" },
        error: null,
      }),
    ];

    await createAddress({
      client_id: "user-1",
      street: "Rua X",
      number: "10",
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
    });

    expect(metrics.count).toHaveBeenCalledWith("addresses.created", 1);
  });
});

describe("updateAddress", () => {
  it("returns null error on success", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    const result = await updateAddress("addr-1", "user-1", { street: "Rua Nova" });

    expect(result.error).toBeNull();
  });

  it("includes h3_index in update payload when latitude and longitude are provided", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    await updateAddress("addr-1", "user-1", {
      street: "Rua Nova",
      latitude: -23.55,
      longitude: -46.63,
    });

    const chain = from.mock.results[0]?.value as MockChain | undefined;
    const updateCall = chain?.update.mock.calls[0]?.[0];
    expect(updateCall).toHaveProperty("h3_index", "8f283082a9b1fff");
    expect(updateCall).toHaveProperty("location");
  });

  it("returns error when update fails", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: { message: "Update failed" } })];

    const result = await updateAddress("addr-1", "user-1", { street: "Rua Nova" });

    expect(result.error).toBe("Update failed");
  });

  it("returns clearOtherDefaults errors when promoting an address to default", async () => {
    terminalReturns = [
      Promise.resolve({ data: null, error: { message: "clear update failed" } }),
    ];

    const result = await updateAddress("addr-1", "user-1", { is_default: true });

    expect(result.error).toBe("clear update failed");
  });

  it("clears other defaults with neq when updating an existing default", async () => {
    terminalReturns = [
      Promise.resolve({ data: null, error: null }),
      Promise.resolve({ data: null, error: null }),
    ];

    const result = await updateAddress("addr-1", "user-1", { is_default: true });

    expect(result.error).toBeNull();
    const clearChain = from.mock.results[0]?.value as
      | { neq: ReturnType<typeof vi.fn> }
      | undefined;
    expect(clearChain?.neq).toHaveBeenCalledWith("id", "addr-1");
  });

  it("does not clear other defaults when is_default is not true", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    await updateAddress("addr-1", "user-1", { street: "Rua Nova", is_default: false });

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("records addresses.updated metric on success", async () => {
    const { metrics } = await import("@/lib/sentry");
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    await updateAddress("addr-1", "user-1", { street: "Rua Nova" });

    expect(metrics.count).toHaveBeenCalledWith("addresses.updated", 1);
  });
});

describe("deleteAddress", () => {
  it("returns null error and soft-deletes", async () => {
    terminalReturns = [Promise.resolve({ data: null, error: null })];

    const result = await deleteAddress("addr-1", "user-1");

    expect(result.error).toBeNull();
  });
});
