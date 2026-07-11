import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProviderPrivateProfile,
  updateProviderPrivateProfile,
} from "../providerPrivateProfile.api";

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
    maybeSingle: vi.fn().mockResolvedValue(result),
    upsert: vi.fn(),
    then: vi.fn(
      (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProviderPrivateProfile", () => {
  it("returns the profile and builds the provider-scoped query", async () => {
    const profile = { provider_id: "provider-1", entity_type: "pj" };
    const query = createQuery({ data: profile, error: null });
    mocks.from.mockReturnValue(query);

    const result = await getProviderPrivateProfile("provider-1");

    expect(result).toEqual({ data: profile, error: null });
    expect(mocks.from).toHaveBeenCalledWith("provider_profiles_private");
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.eq).toHaveBeenCalledWith("provider_id", "provider-1");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("returns null data and logs the Supabase error", async () => {
    const query = createQuery({
      data: null,
      error: { message: "Private profile unavailable" },
    });
    mocks.from.mockReturnValue(query);

    const result = await getProviderPrivateProfile("provider-1");

    expect(result).toEqual({
      data: null,
      error: "Private profile unavailable",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_private_profile_fetch_error",
      {
        error: "Private profile unavailable",
        providerId: "provider-1",
      }
    );
  });
});

describe("updateProviderPrivateProfile", () => {
  it("upserts the provider payload with the expected conflict key", async () => {
    const query = createQuery({ data: null, error: null });
    mocks.from.mockReturnValue(query);
    const params = {
      entity_type: "pj" as const,
      cnpj: "12.345.678/0001-90",
      nome_fantasia: "Orbit Serviços",
    };

    const result = await updateProviderPrivateProfile("provider-1", params);

    expect(result).toEqual({ error: null });
    expect(mocks.from).toHaveBeenCalledWith("provider_profiles_private");
    expect(query.upsert).toHaveBeenCalledWith(
      { provider_id: "provider-1", ...params },
      { onConflict: "provider_id" }
    );
  });

  it("short-circuits when there are no fields to update", async () => {
    const result = await updateProviderPrivateProfile("provider-1", {});

    expect(result).toEqual({ error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns and logs an upsert error", async () => {
    const query = createQuery({
      data: null,
      error: { message: "Private profile conflict" },
    });
    mocks.from.mockReturnValue(query);

    const result = await updateProviderPrivateProfile("provider-1", {
      cpf: "123",
    });

    expect(result).toEqual({ error: "Private profile conflict" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "provider_private_profile_update_error",
      {
        error: "Private profile conflict",
        providerId: "provider-1",
      }
    );
  });
});
