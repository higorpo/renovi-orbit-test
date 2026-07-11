import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveFormDataFromCep } from "../resolveFormDataFromCep";
import * as cepLib from "@/lib/cep";
import * as statesAndCitiesApi from "../../api/statesAndCities.api";

vi.mock("@/lib/cep", () => ({
  fetchAddressByCEP: vi.fn(),
}));

vi.mock("../../api/statesAndCities.api", () => ({
  listStates: vi.fn(),
  listCitiesByState: vi.fn(),
  listNeighborhoodsByCity: vi.fn(),
}));

const fetchAddressByCEP = vi.mocked(cepLib.fetchAddressByCEP);
const listStates = vi.mocked(statesAndCitiesApi.listStates);
const listCitiesByState = vi.mocked(statesAndCitiesApi.listCitiesByState);
const listNeighborhoodsByCity = vi.mocked(statesAndCitiesApi.listNeighborhoodsByCity);

const mockState = {
  id: "state-uuid-1",
  ibge_code: 35,
  name: "São Paulo",
  abbreviation: "SP",
  is_active: true,
  created_at: "",
  updated_at: "",
};
const mockCity = {
  id: "city-uuid-1",
  state_id: mockState.id,
  ibge_code: 3550308,
  name: "São Paulo",
  is_active: true,
  created_at: "",
  updated_at: "",
};
const mockNeighborhood = {
  id: "neighborhood-uuid-1",
  city_id: mockCity.id,
  name: "Bela Vista",
  is_active: true,
  created_at: "",
  updated_at: "",
};

describe("resolveFormDataFromCep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
      ibge: "3550308",
    });
    listStates.mockResolvedValue({ states: [mockState], error: null });
    listCitiesByState.mockResolvedValue({ cities: [mockCity], error: null });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [mockNeighborhood],
      error: null,
    });
  });

  it("returns null when fetchAddressByCEP returns null", async () => {
    fetchAddressByCEP.mockResolvedValue(null);
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toBeNull();
    expect(listStates).not.toHaveBeenCalled();
  });

  it("returns cepNotFound when ViaCEP returns erro true", async () => {
    fetchAddressByCEP.mockResolvedValue({ erro: true });
    const result = await resolveFormDataFromCep("00000-000");
    expect(result).toEqual({ ok: false, cepNotFound: true });
    expect(listStates).not.toHaveBeenCalled();
  });

  it("returns notAvailable when listStates returns error", async () => {
    listStates.mockResolvedValue({ states: [], error: "API error" });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
    expect(listStates).toHaveBeenCalled();
  });

  it("returns notAvailable when listStates returns empty states", async () => {
    listStates.mockResolvedValue({ states: [], error: null });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
  });

  it("returns notAvailable when UF does not match any state", async () => {
    listStates.mockResolvedValue({
      states: [{ ...mockState, abbreviation: "RJ" }],
      error: null,
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
    expect(listCitiesByState).not.toHaveBeenCalled();
  });

  it("returns notAvailable when listCitiesByState returns error", async () => {
    listCitiesByState.mockResolvedValue({ cities: [], error: "Error" });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
    expect(listCitiesByState).toHaveBeenCalledWith(mockState.id);
  });

  it("returns notAvailable when city is not found by ibge or name", async () => {
    listCitiesByState.mockResolvedValue({
      cities: [{ ...mockCity, ibge_code: 999, name: "Other" }],
      error: null,
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
  });

  it("finds city by name when ibge is missing (normalized match)", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "Rua X",
      bairro: "Bela Vista",
      localidade: "Sao Paulo",
      uf: "SP",
      ibge: undefined,
    });
    listCitiesByState.mockResolvedValue({
      cities: [{ ...mockCity, ibge_code: 0, name: "São Paulo" }],
      error: null,
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        address_city_id: mockCity.id,
        address_city: "São Paulo",
      }),
    });
  });

  it("returns notAvailable when listNeighborhoodsByCity returns error", async () => {
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [],
      error: "Error",
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
    expect(listNeighborhoodsByCity).toHaveBeenCalledWith(mockCity.id);
  });

  it("returns notAvailable when neighborhood is not found", async () => {
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [{ ...mockNeighborhood, name: "Outro Bairro" }],
      error: null,
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({ ok: false, notAvailable: true });
  });

  it("returns ok with form data when state, city and neighborhood match", async () => {
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({
      ok: true,
      data: {
        address_street: "Avenida Paulista",
        address_state_id: mockState.id,
        address_state: "SP",
        address_city_id: mockCity.id,
        address_city: "São Paulo",
        address_neighborhood_id: mockNeighborhood.id,
        address_neighborhood: "Bela Vista",
      },
    });
    expect(listStates).toHaveBeenCalled();
    expect(listCitiesByState).toHaveBeenCalledWith(mockState.id);
    expect(listNeighborhoodsByCity).toHaveBeenCalledWith(mockCity.id);
  });

  it("trims and uppercases UF from ViaCEP", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "  sp  ",
      ibge: "3550308",
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    expect(
      result && result.ok && "data" in result ? result.data.address_state : null
    ).toBe("SP");
  });

  it("returns empty address_street when logradouro is missing", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
      ibge: "3550308",
    });
    const result = await resolveFormDataFromCep("01310-100");
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        address_street: "",
      }),
    });
  });
});

describe("resolveFormDataFromCep fallback values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listStates.mockResolvedValue({ states: [mockState], error: null });
    listCitiesByState.mockResolvedValue({ cities: [mockCity], error: null });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [mockNeighborhood],
      error: null,
    });
  });

  it("matches a city by normalized name when the IBGE code is invalid", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "  Rua A  ",
      bairro: "  Bela Vista ",
      localidade: " sao paulo ",
      uf: "sp",
      ibge: "invalid",
    });

    const result = await resolveFormDataFromCep("01310-100");

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        address_street: "Rua A",
        address_city_id: mockCity.id,
        address_neighborhood_id: mockNeighborhood.id,
      }),
    });
  });

  it("returns unavailable when ViaCEP omits the state", async () => {
    fetchAddressByCEP.mockResolvedValue({
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: undefined,
    });

    expect(await resolveFormDataFromCep("01310-100")).toEqual({
      ok: false,
      notAvailable: true,
    });
  });

  it("still resolves by IBGE when ViaCEP omits the city name", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "Rua A",
      bairro: "Bela Vista",
      localidade: undefined,
      uf: "SP",
      ibge: "3550308",
    });

    expect(await resolveFormDataFromCep("01310-100")).toEqual({
      ok: true,
      data: expect.objectContaining({ address_city_id: mockCity.id }),
    });
  });

  it("returns unavailable when ViaCEP omits the neighborhood", async () => {
    fetchAddressByCEP.mockResolvedValue({
      logradouro: "Rua A",
      bairro: undefined,
      localidade: "São Paulo",
      uf: "SP",
      ibge: "3550308",
    });

    expect(await resolveFormDataFromCep("01310-100")).toEqual({
      ok: false,
      notAvailable: true,
    });
  });
});
