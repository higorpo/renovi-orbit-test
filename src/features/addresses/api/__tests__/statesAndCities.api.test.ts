import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listStates,
  listCitiesByState,
  listNeighborhoodsByCity,
} from "../statesAndCities.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const supabase = await import("@/lib/supabase/client").then((m) => m.supabase);
const from = vi.mocked(supabase.from);

function makeChain(terminalResult: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(terminalResult),
  };
  from.mockReturnValue(chain as never);
  return chain;
}

describe("listStates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns states and null error on success", async () => {
    const states = [
      { id: "s1", name: "São Paulo", abbreviation: "SP", ibge_code: 35, is_active: true, created_at: "", updated_at: "" },
    ];
    makeChain({ data: states, error: null });

    const result = await listStates();

    expect(result.states).toEqual(states);
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith("platform_states");
  });

  it("returns empty array and error on failure", async () => {
    makeChain({ data: null, error: { message: "DB error" } });

    const result = await listStates();

    expect(result.states).toEqual([]);
    expect(result.error).toBe("DB error");
  });
});

describe("listCitiesByState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cities and null error on success", async () => {
    const cities = [
      { id: "c1", state_id: "s1", name: "São Paulo", ibge_code: 3550308, is_active: true, created_at: "", updated_at: "" },
    ];
    makeChain({ data: cities, error: null });

    const result = await listCitiesByState("s1");

    expect(result.cities).toEqual(cities);
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith("platform_cities");
  });

  it("returns empty array and error on failure", async () => {
    makeChain({ data: null, error: { message: "Error" } });

    const result = await listCitiesByState("s1");

    expect(result.cities).toEqual([]);
    expect(result.error).toBe("Error");
  });
});

describe("listNeighborhoodsByCity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns neighborhoods and null error on success", async () => {
    const neighborhoods = [
      { id: "n1", city_id: "c1", name: "Centro", is_active: true, created_at: "", updated_at: "" },
    ];
    makeChain({ data: neighborhoods, error: null });

    const result = await listNeighborhoodsByCity("c1");

    expect(result.neighborhoods).toEqual(neighborhoods);
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith("platform_neighborhoods");
  });

  it("returns empty array and error on failure", async () => {
    makeChain({ data: null, error: { message: "Error" } });

    const result = await listNeighborhoodsByCity("c1");

    expect(result.neighborhoods).toEqual([]);
    expect(result.error).toBe("Error");
  });
});
