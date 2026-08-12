import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPortfolioItem,
  deletePortfolioItem,
  getPortfolioImageSignedUrl,
  listPortfolioItems,
  reorderPortfolioItems,
  updatePortfolioItem,
} from "../portfolio.api";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}));

type QueryResult = {
  data?: unknown;
  error: { message: string } | null;
};

function createQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn(),
    delete: vi.fn(),
    then: vi.fn(
      (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPortfolioItems", () => {
  it("returns items using provider, sort order, and creation order", async () => {
    const items = [
      { id: "item-1", provider_id: "provider-1", title: "Kitchen" },
    ];
    const query = createQuery({ data: items, error: null });
    mocks.from.mockReturnValue(query);

    const result = await listPortfolioItems("provider-1");

    expect(result).toEqual({ items, error: null });
    expect(mocks.from).toHaveBeenCalledWith("provider_portfolio_items");
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.eq).toHaveBeenCalledWith("provider_id", "provider-1");
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order", {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: true,
    });
  });

  it("returns an empty list and logs list errors", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Portfolio unavailable" } })
    );

    const result = await listPortfolioItems("provider-1");

    expect(result).toEqual({
      items: [],
      error: "Portfolio unavailable",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_portfolio_list_error",
      { error: "Portfolio unavailable", providerId: "provider-1" }
    );
  });
});

describe("createPortfolioItem", () => {
  it("inserts explicit values and returns the created item", async () => {
    const item = {
      id: "item-1",
      provider_id: "provider-1",
      title: "Kitchen",
      visibility: "private",
    };
    const query = createQuery({ data: item, error: null });
    mocks.from.mockReturnValue(query);
    const params = {
      id: "item-1",
      title: "Kitchen",
      description: "Full renovation",
      service_id: "service-1",
      execution_date: "2026-06-01",
      image_paths: ["providers/provider-1/kitchen.jpg"],
      city_region: "Florianópolis, SC",
      visibility: "private" as const,
      featured: true,
      sort_order: 2,
    };

    const result = await createPortfolioItem("provider-1", params);

    expect(result).toEqual({ data: item, error: null });
    expect(query.insert).toHaveBeenCalledWith({
      provider_id: "provider-1",
      ...params,
    });
    expect(query.select).toHaveBeenCalledWith();
    expect(query.single).toHaveBeenCalledOnce();
  });

  it("applies defaults for optional portfolio fields", async () => {
    const query = createQuery({
      data: { id: "item-1", title: "Kitchen" },
      error: null,
    });
    mocks.from.mockReturnValue(query);

    await createPortfolioItem("provider-1", { title: "Kitchen" });

    expect(query.insert).toHaveBeenCalledWith({
      id: undefined,
      provider_id: "provider-1",
      title: "Kitchen",
      description: null,
      service_id: null,
      execution_date: null,
      image_paths: [],
      city_region: null,
      visibility: "public",
      featured: false,
      sort_order: 0,
    });
  });

  it("returns null data and logs create errors", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Create failed" } })
    );

    const result = await createPortfolioItem("provider-1", {
      title: "Kitchen",
    });

    expect(result).toEqual({ data: null, error: "Create failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_portfolio_create_error",
      { error: "Create failed", providerId: "provider-1" }
    );
  });
});

describe("updatePortfolioItem", () => {
  it("updates only the item owned by the provider", async () => {
    const query = createQuery({ error: null });
    mocks.from.mockReturnValue(query);

    const result = await updatePortfolioItem("item-1", "provider-1", {
      title: "Updated kitchen",
      featured: true,
    });

    expect(result).toEqual({ error: null });
    expect(query.update).toHaveBeenCalledWith({
      title: "Updated kitchen",
      featured: true,
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "item-1");
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      "provider_id",
      "provider-1"
    );
  });

  it("short-circuits for an empty update", async () => {
    const result = await updatePortfolioItem("item-1", "provider-1", {});

    expect(result).toEqual({ error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns and logs update errors with item context", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Update denied" } })
    );

    const result = await updatePortfolioItem("item-1", "provider-1", {
      title: "Updated",
    });

    expect(result).toEqual({ error: "Update denied" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_portfolio_update_error",
      {
        error: "Update denied",
        providerId: "provider-1",
        itemId: "item-1",
      }
    );
  });
});

describe("deletePortfolioItem", () => {
  it("deletes only the item owned by the provider", async () => {
    const query = createQuery({ error: null });
    mocks.from.mockReturnValue(query);

    const result = await deletePortfolioItem("item-1", "provider-1");

    expect(result).toEqual({ error: null });
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "item-1");
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      "provider_id",
      "provider-1"
    );
  });

  it("returns and logs delete errors with item context", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Delete denied" } })
    );

    const result = await deletePortfolioItem("item-1", "provider-1");

    expect(result).toEqual({ error: "Delete denied" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_portfolio_delete_error",
      {
        error: "Delete denied",
        providerId: "provider-1",
        itemId: "item-1",
      }
    );
  });
});

describe("reorderPortfolioItems", () => {
  it("updates each item with its array index and provider scope", async () => {
    const firstQuery = createQuery({ error: null });
    const secondQuery = createQuery({ error: null });
    mocks.from
      .mockReturnValueOnce(firstQuery)
      .mockReturnValueOnce(secondQuery);

    const result = await reorderPortfolioItems("provider-1", [
      "item-2",
      "item-1",
    ]);

    expect(result).toEqual({ error: null });
    expect(firstQuery.update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(firstQuery.eq).toHaveBeenNthCalledWith(1, "id", "item-2");
    expect(firstQuery.eq).toHaveBeenNthCalledWith(
      2,
      "provider_id",
      "provider-1"
    );
    expect(secondQuery.update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(secondQuery.eq).toHaveBeenNthCalledWith(1, "id", "item-1");
  });

  it("returns the first update error and logs it", async () => {
    mocks.from
      .mockReturnValueOnce(
        createQuery({ error: { message: "First reorder failed" } })
      )
      .mockReturnValueOnce(
        createQuery({ error: { message: "Second reorder failed" } })
      );

    const result = await reorderPortfolioItems("provider-1", [
      "item-1",
      "item-2",
    ]);

    expect(result).toEqual({ error: "First reorder failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_portfolio_reorder_error",
      { error: "First reorder failed", providerId: "provider-1" }
    );
  });

  it("does not issue queries for an empty order", async () => {
    const result = await reorderPortfolioItems("provider-1", []);

    expect(result).toEqual({ error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("getPortfolioImageSignedUrl", () => {
  it("returns a signed URL from the portfolio image bucket", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://cdn.example.com/portfolio.jpg" },
      error: null,
    });
    mocks.storageFrom.mockReturnValue({ createSignedUrl });

    const result = await getPortfolioImageSignedUrl(
      "providers/provider-1/image.jpg"
    );

    expect(result).toBe("https://cdn.example.com/portfolio.jpg");
    expect(mocks.storageFrom).toHaveBeenCalledWith(
      "provider-portfolio-images"
    );
    expect(createSignedUrl).toHaveBeenCalledWith(
      "providers/provider-1/image.jpg",
      3600
    );
  });

  it("returns an empty string for storage errors", async () => {
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Signing failed" },
      }),
    });

    await expect(getPortfolioImageSignedUrl("image.jpg")).resolves.toBe("");
  });

  it("returns an empty string when the signed URL is missing", async () => {
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),
    });

    await expect(getPortfolioImageSignedUrl("image.jpg")).resolves.toBe("");
  });
});
