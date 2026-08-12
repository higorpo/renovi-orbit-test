import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProviderPublicProfile,
  slugify,
  updateProviderPublicProfile,
} from "../providerPublicProfile.api";

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
    in: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    then: vi.fn(
      (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("slugify", () => {
  it("normalizes accents, casing, whitespace, and punctuation", () => {
    expect(slugify("  João & Filhos — Reformas!  ")).toBe(
      "joao-filhos-reformas"
    );
  });

  it("uses the profile fallback when no alphanumeric characters remain", () => {
    expect(slugify(" -- !!! -- ")).toBe("perfil");
  });
});

describe("getProviderPublicProfile", () => {
  it("returns the profile with derived service-area display fields", async () => {
    const profile = { provider_id: "provider-1", slug: "orbit-reformas" };
    const profileQuery = createQuery({ data: profile, error: null });
    const areaQuery = createQuery({
      data: [
        { neighborhood_id: "neighborhood-2" },
        { neighborhood_id: "neighborhood-1" },
        { neighborhood_id: "neighborhood-3" },
      ],
      error: null,
    });
    const neighborhoodQuery = createQuery({
      data: [
        {
          name: "Centro",
          platform_cities: {
            name: "Florianópolis",
            platform_states: { abbreviation: "SC" },
          },
        },
        {
          name: "Trindade",
          platform_cities: {
            name: "Florianópolis",
            platform_states: { abbreviation: "SC" },
          },
        },
        {
          name: "Centro",
          platform_cities: {
            name: "São José",
            platform_states: { abbreviation: "SC" },
          },
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(areaQuery)
      .mockReturnValueOnce(neighborhoodQuery);

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({
      data: {
        ...profile,
        service_area_neighborhood_ids: [
          "neighborhood-2",
          "neighborhood-1",
          "neighborhood-3",
        ],
        service_area_city: "Florianópolis, São José",
        service_area_regions: ["SC"],
        service_area_neighborhoods: ["Centro", "Trindade", "Centro"],
      },
      error: null,
    });
    expect(profileQuery.select).toHaveBeenCalledWith("*");
    expect(profileQuery.eq).toHaveBeenCalledWith(
      "provider_id",
      "provider-1"
    );
    expect(areaQuery.select).toHaveBeenCalledWith("neighborhood_id");
    expect(neighborhoodQuery.in).toHaveBeenCalledWith("id", [
      "neighborhood-2",
      "neighborhood-1",
      "neighborhood-3",
    ]);
    expect(neighborhoodQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });

  it("returns null without querying service areas when profile fetch fails", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Profile fetch failed" } })
    );

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({ data: null, error: "Profile fetch failed" });
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_public_profile_fetch_error",
      { error: "Profile fetch failed", providerId: "provider-1" }
    );
  });

  it("returns an empty service area when no neighborhoods are linked", async () => {
    const profile = { provider_id: "provider-1", slug: "provider-1" };
    mocks.from
      .mockReturnValueOnce(createQuery({ data: profile, error: null }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({
      data: {
        ...profile,
        service_area_neighborhood_ids: [],
        service_area_city: null,
        service_area_regions: null,
        service_area_neighborhoods: null,
      },
      error: null,
    });
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("preserves the profile and reports a service-area link error", async () => {
    const profile = { provider_id: "provider-1", slug: "provider-1" };
    mocks.from
      .mockReturnValueOnce(createQuery({ data: profile, error: null }))
      .mockReturnValueOnce(
        createQuery({ error: { message: "Area links unavailable" } })
      );

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({
      data: {
        ...profile,
        service_area_neighborhood_ids: [],
        service_area_city: null,
        service_area_regions: null,
        service_area_neighborhoods: null,
      },
      error: "Area links unavailable",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_service_area_neighborhoods_fetch_error",
      { error: "Area links unavailable", providerId: "provider-1" }
    );
  });

  it("preserves neighborhood IDs when display data cannot be fetched", async () => {
    const profile = { provider_id: "provider-1", slug: "provider-1" };
    mocks.from
      .mockReturnValueOnce(createQuery({ data: profile, error: null }))
      .mockReturnValueOnce(
        createQuery({
          data: [{ neighborhood_id: "neighborhood-1" }],
          error: null,
        })
      )
      .mockReturnValueOnce(
        createQuery({ error: { message: "Neighborhoods unavailable" } })
      );

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({
      data: {
        ...profile,
        service_area_neighborhood_ids: ["neighborhood-1"],
        service_area_city: null,
        service_area_regions: null,
        service_area_neighborhoods: null,
      },
      error: "Neighborhoods unavailable",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "platform_neighborhoods_for_provider_fetch_error",
      { error: "Neighborhoods unavailable", providerId: "provider-1" }
    );
  });

  it("returns null data when no public profile exists", async () => {
    mocks.from
      .mockReturnValueOnce(createQuery({ data: null, error: null }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

    const result = await getProviderPublicProfile("provider-1");

    expect(result).toEqual({ data: null, error: null });
  });
});

describe("updateProviderPublicProfile", () => {
  it("updates public fields without exposing service-area IDs in the payload", async () => {
    const deleteQuery = createQuery({ error: null });
    const insertQuery = createQuery({ error: null });
    const updateQuery = createQuery({ error: null });
    mocks.from
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(updateQuery);

    const result = await updateProviderPublicProfile("provider-1", {
      bio: "Residential renovation specialist",
      profile_visibility: "public",
      service_area_neighborhood_ids: [
        "neighborhood-1",
        "neighborhood-2",
      ],
    });

    expect(result).toEqual({ error: null });
    expect(deleteQuery.delete).toHaveBeenCalledOnce();
    expect(insertQuery.insert).toHaveBeenCalledWith([
      {
        provider_id: "provider-1",
        neighborhood_id: "neighborhood-1",
      },
      {
        provider_id: "provider-1",
        neighborhood_id: "neighborhood-2",
      },
    ]);
    expect(updateQuery.update).toHaveBeenCalledWith({
      bio: "Residential renovation specialist",
      profile_visibility: "public",
    });
    expect(updateQuery.eq).toHaveBeenCalledWith(
      "provider_id",
      "provider-1"
    );
  });

  it("generates a stable-format slug when the current slug is the provider ID", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const slugQuery = createQuery({
      data: { slug: "provider-1" },
      error: null,
    });
    const updateQuery = createQuery({ error: null });
    mocks.from
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(updateQuery);

    const result = await updateProviderPublicProfile("provider-1", {
      display_name: "João Reformas",
    });

    expect(result).toEqual({ error: null });
    expect(slugQuery.select).toHaveBeenCalledWith("slug");
    expect(updateQuery.update).toHaveBeenCalledWith({
      display_name: "João Reformas",
      slug: "joao-reformas-loyw3v28-i",
    });
  });

  it("keeps a custom slug when the display name changes", async () => {
    const slugQuery = createQuery({
      data: { slug: "custom-slug" },
      error: null,
    });
    const updateQuery = createQuery({ error: null });
    mocks.from
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(updateQuery);

    await updateProviderPublicProfile("provider-1", {
      display_name: "New Name",
    });

    expect(updateQuery.update).toHaveBeenCalledWith({
      display_name: "New Name",
    });
  });

  it("clears service-area rows without inserting or updating a profile", async () => {
    const deleteQuery = createQuery({ error: null });
    mocks.from.mockReturnValue(deleteQuery);

    const result = await updateProviderPublicProfile("provider-1", {
      service_area_neighborhood_ids: [],
    });

    expect(result).toEqual({ error: null });
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(deleteQuery.insert).not.toHaveBeenCalled();
    expect(deleteQuery.update).not.toHaveBeenCalled();
  });

  it("does nothing when service-area IDs are null", async () => {
    const result = await updateProviderPublicProfile("provider-1", {
      service_area_neighborhood_ids: null,
    });

    expect(result).toEqual({ error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("stops and logs when deleting service-area rows fails", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Area delete failed" } })
    );

    const result = await updateProviderPublicProfile("provider-1", {
      bio: "This update must not run",
      service_area_neighborhood_ids: ["neighborhood-1"],
    });

    expect(result).toEqual({ error: "Area delete failed" });
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_service_area_neighborhoods_delete_error",
      { error: "Area delete failed", providerId: "provider-1" }
    );
  });

  it("returns and logs a service-area insert error", async () => {
    mocks.from
      .mockReturnValueOnce(createQuery({ error: null }))
      .mockReturnValueOnce(
        createQuery({ error: { message: "Area insert failed" } })
      );

    const result = await updateProviderPublicProfile("provider-1", {
      service_area_neighborhood_ids: ["neighborhood-1"],
    });

    expect(result).toEqual({ error: "Area insert failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_service_area_neighborhoods_insert_error",
      { error: "Area insert failed", providerId: "provider-1" }
    );
  });

  it("returns and logs a final profile update error", async () => {
    mocks.from.mockReturnValue(
      createQuery({ error: { message: "Profile update failed" } })
    );

    const result = await updateProviderPublicProfile("provider-1", {
      bio: "Updated bio",
    });

    expect(result).toEqual({ error: "Profile update failed" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_public_profile_update_error",
      { error: "Profile update failed", providerId: "provider-1" }
    );
  });
});
