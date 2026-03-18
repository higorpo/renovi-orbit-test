import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  slugify,
  getProviderPrivateProfile,
  updateProviderPrivateProfile,
  getProviderPublicProfile,
  updateProviderPublicProfile,
  searchServices,
  getServicesByIds,
  listOfferedServices,
  setOfferedServices,
  listPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  reorderPortfolioItems,
  getPortfolioImageSignedUrl,
} from "../providerProfile.api";

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function chainMock(returnValue: { data?: unknown; error?: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
    single: vi.fn().mockResolvedValue(returnValue),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { data: null; error: typeof returnValue.error }) => void) => {
        queueMicrotask(() =>
          resolve({ data: null, error: returnValue.error ?? null })
        );
      };
      return this;
    }),
    delete: vi.fn().mockReturnThis(),
    then(resolve: (v: typeof returnValue) => void) {
      queueMicrotask(() => resolve(returnValue));
    },
  };
  return chain;
}

function chainMockUpdate(returnValue: { error: { message: string } | null }) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { data: null; error: typeof returnValue.error }) => void) => {
        queueMicrotask(() => resolve({ data: null, error: returnValue.error }));
      };
      return this;
    }),
    then(resolve: (v: { data: null; error: typeof returnValue.error }) => void) {
      queueMicrotask(() => resolve({ data: null, error: returnValue.error }));
    },
  };
  return chain;
}

describe("slugify", () => {
  it("normalizes text to lowercase hyphenated slug", () => {
    expect(slugify("João Silva")).toBe("joao-silva");
  });

  it("strips accents and non-alphanumeric", () => {
    expect(slugify("Açúcar & Café!")).toBe("acucar-cafe");
  });

  it("returns 'perfil' for empty after trim", () => {
    expect(slugify("   ")).toBe("perfil");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --  x  --  ")).toBe("x");
  });
});

describe("getProviderPrivateProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns data and null error on success", async () => {
    const row = { provider_id: "p1", entity_type: "pf" };
    mockFrom.mockReturnValue(
      chainMock({ data: row, error: null })
    );

    const result = await getProviderPrivateProfile("p1");

    expect(result.data).toEqual(row);
    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("provider_profiles_private");
  });

  it("returns null data and error message on supabase error", async () => {
    mockFrom.mockReturnValue(
      chainMock({ data: null, error: { message: "Network error" } })
    );

    const result = await getProviderPrivateProfile("p1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Network error");
  });
});

describe("updateProviderPrivateProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error on success", async () => {
    const chain = chainMockUpdate({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateProviderPrivateProfile("p1", { entity_type: "pj" });

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("provider_profiles_private");
  });

  it("returns null error when params empty", async () => {
    const result = await updateProviderPrivateProfile("p1", {});
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns error message on supabase error", async () => {
    const chain = chainMockUpdate({ error: { message: "Conflict" } });
    mockFrom.mockReturnValue(chain);

    const result = await updateProviderPrivateProfile("p1", { cpf: "123" });

    expect(result.error).toBe("Conflict");
  });
});

describe("getProviderPublicProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns public data with service_area_neighborhood_ids", async () => {
    const publicRow = { provider_id: "p1", slug: "meu-perfil" };
    mockFrom
      .mockReturnValueOnce(chainMock({ data: publicRow, error: null }))
      .mockReturnValueOnce(
        Object.assign(chainMock({ data: [{ neighborhood_id: "n1" }], error: null }), {
          then: (resolve: (v: { data: { neighborhood_id: string }[] }) => void) =>
            resolve({ data: [{ neighborhood_id: "n1" }] }),
        })
      );

    const result = await getProviderPublicProfile("p1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.provider_id).toBe("p1");
    expect(result.data?.service_area_neighborhood_ids).toEqual(["n1"]);
  });

  it("returns null data and error on public fetch error", async () => {
    mockFrom.mockReturnValue(
      chainMock({ data: null, error: { message: "Not found" } })
    );

    const result = await getProviderPublicProfile("p1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Not found");
  });
});

describe("updateProviderPublicProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error when only updating service_area_neighborhood_ids and insert succeeds", async () => {
    const deleteChain = chainMockUpdate({ error: null });
    const insertChain = chainMock({ data: null, error: null });
    const neighborhoodRows = [
      { name: "Centro", platform_cities: { name: "Floripa" } },
    ];
    const selectNeighborhoodsChain = chainMock({
      data: neighborhoodRows,
      error: null,
    });
    const updateChain = chainMockUpdate({ error: null });
    mockFrom
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(selectNeighborhoodsChain)
      .mockReturnValueOnce(updateChain);

    const result = await updateProviderPublicProfile("p1", {
      service_area_neighborhood_ids: ["n1"],
    });

    expect(result.error).toBeNull();
  });

  it("returns error when delete of service_area_neighborhoods fails", async () => {
    const deleteChain = chainMockUpdate({ error: { message: "DB error" } });
    mockFrom.mockReturnValueOnce(deleteChain);

    const result = await updateProviderPublicProfile("p1", {
      service_area_neighborhood_ids: ["n1"],
    });

    expect(result.error).toBe("DB error");
  });

  it("recomputes slug from display_name when display_name is updated", async () => {
    const slugCheckChain = chainMock({ data: null, error: null });
    const updateChain = chainMockUpdate({ error: null });
    mockFrom.mockReturnValueOnce(slugCheckChain).mockReturnValueOnce(updateChain);

    const result = await updateProviderPublicProfile("p1", {
      display_name: "Maria Santos",
    });

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("provider_profiles_public");
    const updateCall = updateChain.update.mock.calls[0];
    expect(updateCall[0]).toMatchObject({ display_name: "Maria Santos" });
    expect(updateCall[0].slug).toMatch(/^maria-santos-[a-z0-9]+-[a-z0-9]+$/);
  });
});

describe("searchServices", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns services and null error on success", async () => {
    const services = [{ id: "s1", title: "Pintura", icon_key: null, color_key: null }];
    mockFrom.mockReturnValue(chainMock({ data: services, error: null }));

    const result = await searchServices("pint");

    expect(result.error).toBeNull();
    expect(result.services).toEqual(services);
  });

  it("returns empty array and error on supabase error", async () => {
    mockFrom.mockReturnValue(chainMock({ data: null, error: { message: "Fail" } }));

    const result = await searchServices("x");

    expect(result.services).toEqual([]);
    expect(result.error).toBe("Fail");
  });
});

describe("getServicesByIds", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns empty array and null error when ids empty", async () => {
    const result = await getServicesByIds([]);
    expect(result.services).toEqual([]);
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns services and null error on success", async () => {
    const services = [{ id: "s1", title: "Pintura", icon_key: null, color_key: null }];
    mockFrom.mockReturnValue(chainMock({ data: services, error: null }));

    const result = await getServicesByIds(["s1"]);

    expect(result.error).toBeNull();
    expect(result.services).toEqual(services);
  });
});

describe("listOfferedServices", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns serviceIds and null error on success", async () => {
    mockFrom.mockReturnValue(
      chainMock({ data: [{ service_id: "s1" }, { service_id: "s2" }], error: null })
    );

    const result = await listOfferedServices("p1");

    expect(result.error).toBeNull();
    expect(result.serviceIds).toEqual(["s1", "s2"]);
  });

  it("returns empty array and error on supabase error", async () => {
    mockFrom.mockReturnValue(chainMock({ data: null, error: { message: "Err" } }));

    const result = await listOfferedServices("p1");

    expect(result.serviceIds).toEqual([]);
    expect(result.error).toBe("Err");
  });
});

describe("setOfferedServices", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error when delete and insert succeed", async () => {
    const deleteChain = chainMockUpdate({ error: null });
    const insertChain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteChain).mockReturnValueOnce(insertChain);

    const result = await setOfferedServices("p1", ["s1", "s2"]);

    expect(result.error).toBeNull();
  });

  it("returns null error when serviceIds empty after delete", async () => {
    const deleteChain = chainMockUpdate({ error: null });
    mockFrom.mockReturnValueOnce(deleteChain);

    const result = await setOfferedServices("p1", []);

    expect(result.error).toBeNull();
  });

  it("returns error when delete fails", async () => {
    mockFrom.mockReturnValueOnce(chainMockUpdate({ error: { message: "DB" } }));

    const result = await setOfferedServices("p1", ["s1"]);

    expect(result.error).toBe("DB");
  });
});

describe("listPortfolioItems", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns items and null error on success", async () => {
    const items = [{ id: "i1", provider_id: "p1", title: "Job" }];
    mockFrom.mockReturnValue(chainMock({ data: items, error: null }));

    const result = await listPortfolioItems("p1");

    expect(result.error).toBeNull();
    expect(result.items).toEqual(items);
  });
});

describe("createPortfolioItem", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns data and null error on success", async () => {
    const item = { id: "i1", provider_id: "p1", title: "Job" };
    mockFrom.mockReturnValue(chainMock({ data: item, error: null }));

    const result = await createPortfolioItem("p1", { title: "Job" });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(item);
  });

  it("returns null data and error on supabase error", async () => {
    mockFrom.mockReturnValue(chainMock({ data: null, error: { message: "Fail" } }));

    const result = await createPortfolioItem("p1", { title: "Job" });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Fail");
  });
});

describe("updatePortfolioItem", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error on success", async () => {
    mockFrom.mockReturnValue(chainMockUpdate({ error: null }));

    const result = await updatePortfolioItem("i1", "p1", { title: "New" });

    expect(result.error).toBeNull();
  });

  it("returns null error when params empty", async () => {
    const result = await updatePortfolioItem("i1", "p1", {});
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("deletePortfolioItem", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error on success", async () => {
    mockFrom.mockReturnValue(chainMockUpdate({ error: null }));

    const result = await deletePortfolioItem("i1", "p1");

    expect(result.error).toBeNull();
  });
});

describe("reorderPortfolioItems", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error when all updates succeed", async () => {
    mockFrom.mockReturnValue(chainMockUpdate({ error: null }));

    const result = await reorderPortfolioItems("p1", ["i1", "i2"]);

    expect(result.error).toBeNull();
  });

  it("returns error when one update fails", async () => {
    mockFrom.mockReturnValue(chainMockUpdate({ error: { message: "Fail" } }));

    const result = await reorderPortfolioItems("p1", ["i1"]);

    expect(result.error).toBe("Fail");
  });
});

describe("getPortfolioImageSignedUrl", () => {
  beforeEach(() => {
    mockStorageFrom.mockClear();
  });

  it("returns signed URL on success", async () => {
    const chain = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.url/img" },
        error: null,
      }),
    };
    mockStorageFrom.mockReturnValue(chain);

    const url = await getPortfolioImageSignedUrl("path/to/img.jpg");

    expect(url).toBe("https://signed.url/img");
  });

  it("returns empty string on error", async () => {
    const chain = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Err" },
      }),
    };
    mockStorageFrom.mockReturnValue(chain);

    const url = await getPortfolioImageSignedUrl("path");

    expect(url).toBe("");
  });
});
