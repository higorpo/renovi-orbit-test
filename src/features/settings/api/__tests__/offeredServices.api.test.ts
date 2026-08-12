import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getServicesByIds,
  listOfferedServices,
  searchServices,
  setOfferedServices,
} from "../offeredServices.api";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: mocks.from },
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
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    then: vi.fn(
      (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchServices", () => {
  it("normalizes the search and returns matching active services", async () => {
    const services = [
      {
        id: "service-1",
        title: "Pintura",
        icon_key: "paint",
        color_key: "blue",
      },
    ];
    const query = createQuery({ data: services, error: null });
    mocks.from.mockReturnValue(query);

    const result = await searchServices("  PINT  ");

    expect(result).toEqual({ services, error: null });
    expect(mocks.from).toHaveBeenCalledWith("platform_services");
    expect(query.select).toHaveBeenCalledWith(
      "id, title, icon_key, color_key"
    );
    expect(query.eq).toHaveBeenCalledWith("active", true);
    expect(query.ilike).toHaveBeenCalledWith("title", "%pint%");
    expect(query.order).toHaveBeenCalledWith("title", { ascending: true });
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it("uses a wildcard for an empty search", async () => {
    const query = createQuery({ data: null, error: null });
    mocks.from.mockReturnValue(query);

    const result = await searchServices("   ");

    expect(result).toEqual({ services: [], error: null });
    expect(query.ilike).toHaveBeenCalledWith("title", "%");
  });

  it("returns an empty list and logs search errors", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Search failed" } })
    );

    const result = await searchServices("paint");

    expect(result).toEqual({ services: [], error: "Search failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith("services_search_error", {
      error: "Search failed",
    });
  });
});

describe("getServicesByIds", () => {
  it("short-circuits when no service IDs are provided", async () => {
    const result = await getServicesByIds([]);

    expect(result).toEqual({ services: [], error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("fetches only the requested service IDs", async () => {
    const services = [
      {
        id: "service-2",
        title: "Elétrica",
        icon_key: null,
        color_key: null,
      },
    ];
    const query = createQuery({ data: services, error: null });
    mocks.from.mockReturnValue(query);

    const result = await getServicesByIds(["service-2", "service-3"]);

    expect(result).toEqual({ services, error: null });
    expect(query.in).toHaveBeenCalledWith("id", ["service-2", "service-3"]);
  });

  it("returns an empty list and logs fetch errors", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Services unavailable" } })
    );

    const result = await getServicesByIds(["service-1"]);

    expect(result).toEqual({
      services: [],
      error: "Services unavailable",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith("services_by_ids_error", {
      error: "Services unavailable",
    });
  });
});

describe("listOfferedServices", () => {
  it("returns service IDs in the query order", async () => {
    const query = createQuery({
      data: [{ service_id: "service-2" }, { service_id: "service-1" }],
      error: null,
    });
    mocks.from.mockReturnValue(query);

    const result = await listOfferedServices("provider-1");

    expect(result).toEqual({
      serviceIds: ["service-2", "service-1"],
      error: null,
    });
    expect(mocks.from).toHaveBeenCalledWith("provider_offered_services");
    expect(query.select).toHaveBeenCalledWith("service_id");
    expect(query.eq).toHaveBeenCalledWith("provider_id", "provider-1");
    expect(query.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
  });

  it("returns an empty list and logs list errors", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "List failed" } })
    );

    const result = await listOfferedServices("provider-1");

    expect(result).toEqual({ serviceIds: [], error: "List failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_offered_services_list_error",
      { error: "List failed", providerId: "provider-1" }
    );
  });
});

describe("setOfferedServices", () => {
  it("replaces offered services while preserving the provided order", async () => {
    const deleteQuery = createQuery({ error: null });
    const insertQuery = createQuery({ error: null });
    mocks.from
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery);

    const result = await setOfferedServices("provider-1", [
      "service-3",
      "service-1",
    ]);

    expect(result).toEqual({ error: null });
    expect(deleteQuery.delete).toHaveBeenCalledOnce();
    expect(deleteQuery.eq).toHaveBeenCalledWith(
      "provider_id",
      "provider-1"
    );
    expect(insertQuery.insert).toHaveBeenCalledWith([
      {
        provider_id: "provider-1",
        service_id: "service-3",
        sort_order: 0,
      },
      {
        provider_id: "provider-1",
        service_id: "service-1",
        sort_order: 1,
      },
    ]);
  });

  it("only deletes existing rows when the new selection is empty", async () => {
    const deleteQuery = createQuery({ error: null });
    mocks.from.mockReturnValue(deleteQuery);

    const result = await setOfferedServices("provider-1", []);

    expect(result).toEqual({ error: null });
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(deleteQuery.insert).not.toHaveBeenCalled();
  });

  it("stops and logs when deleting existing services fails", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Delete denied" } })
    );

    const result = await setOfferedServices("provider-1", ["service-1"]);

    expect(result).toEqual({ error: "Delete denied" });
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_offered_services_set_delete_error",
      { error: "Delete denied", providerId: "provider-1" }
    );
  });

  it("returns and logs an insert error after deletion succeeds", async () => {
    mocks.from
      .mockReturnValueOnce(createQuery({ error: null }))
      .mockReturnValueOnce(
        createQuery({ error: { message: "Duplicate service" } })
      );

    const result = await setOfferedServices("provider-1", ["service-1"]);

    expect(result).toEqual({ error: "Duplicate service" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_offered_services_set_insert_error",
      { error: "Duplicate service", providerId: "provider-1" }
    );
  });
});
