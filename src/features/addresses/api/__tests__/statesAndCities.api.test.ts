import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listStates,
  listCitiesByState,
  listNeighborhoodsByCity,
  getNeighborhoodsByIds,
  searchCities,
} from "../statesAndCities.api";
import { logger } from "@/lib/logger";

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

describe("getNeighborhoodsByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns immediately when no valid ids are provided", async () => {
    await expect(getNeighborhoodsByIds(["", ""])).resolves.toEqual({
      neighborhoods: [],
      error: null,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("deduplicates ids and maps joined city data", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: "n1",
            name: "Centro",
            city_id: "c1",
            platform_cities: {
              name: "Florianópolis",
              platform_states: { abbreviation: "SC" },
            },
          },
          {
            id: "n2",
            name: "Interior",
            city_id: "c2",
            platform_cities: null,
          },
        ],
        error: null,
      }),
    };
    from.mockReturnValue(query as never);

    const result = await getNeighborhoodsByIds(["n1", "n1", "n2"]);

    expect(query.in).toHaveBeenCalledWith("id", ["n1", "n2"]);
    expect(result).toEqual({
      neighborhoods: [
        {
          id: "n1",
          name: "Centro",
          city_id: "c1",
          city_name: "Florianópolis",
          state_abbreviation: "SC",
        },
        {
          id: "n2",
          name: "Interior",
          city_id: "c2",
          city_name: "",
          state_abbreviation: "",
        },
      ],
      error: null,
    });
  });

  it("chunks large id lists and merges every response", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: "n0", name: "First", city_id: "c1", platform_cities: null }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: "n100", name: "Last", city_id: "c2", platform_cities: null }],
          error: null,
        }),
    };
    from.mockReturnValue(query as never);
    const ids = Array.from({ length: 101 }, (_, index) => `n${index}`);

    const result = await getNeighborhoodsByIds(ids);

    expect(query.in).toHaveBeenCalledTimes(2);
    expect(query.in.mock.calls[0][1]).toHaveLength(100);
    expect(query.in.mock.calls[1][1]).toEqual(["n100"]);
    expect(result.neighborhoods.map((item) => item.id)).toEqual(["n0", "n100"]);
  });

  it("returns the first chunk error and logs it", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: { message: "lookup failed" } }),
    };
    from.mockReturnValue(query as never);

    await expect(getNeighborhoodsByIds(["n1"])).resolves.toEqual({
      neighborhoods: [],
      error: "lookup failed",
    });
    expect(logger.error).toHaveBeenCalledWith("platform_neighborhoods_by_ids_error", {
      error: "lookup failed",
    });
  });
});

describe("searchCities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the query for blank input", async () => {
    await expect(searchCities("   ")).resolves.toEqual({ cities: [], error: null });
    expect(from).not.toHaveBeenCalled();
  });

  it("trims the query and maps state abbreviations", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c1",
            name: "Florianópolis",
            platform_states: { abbreviation: "SC" },
          },
          { id: "c2", name: "Flórida", platform_states: null },
        ],
        error: null,
      }),
    };
    from.mockReturnValue(query as never);

    const result = await searchCities("  Flo ");

    expect(query.ilike).toHaveBeenCalledWith("name", "%Flo%");
    expect(query.limit).toHaveBeenCalledWith(30);
    expect(result.cities).toEqual([
      { id: "c1", name: "Florianópolis", state_abbreviation: "SC" },
      { id: "c2", name: "Flórida", state_abbreviation: "" },
    ]);
  });

  it("returns and logs search errors", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "search failed" },
      }),
    };
    from.mockReturnValue(query as never);

    await expect(searchCities("Flo")).resolves.toEqual({
      cities: [],
      error: "search failed",
    });
    expect(logger.error).toHaveBeenCalledWith("platform_cities_search_error", {
      error: "search failed",
    });
  });
});
