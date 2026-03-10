import { fetchAddressByCEP } from "@/lib/cep";
import { listStates, listCitiesByState, listNeighborhoodsByCity } from "../api/statesAndCities.api";
import type { AddressFormData } from "../types/addressForm.validation";

export type ResolveCepResult =
  | { ok: true; data: Partial<AddressFormData> }
  | { ok: false; notAvailable: true }
  | { ok: false; cepNotFound: true }
  | null;

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Resolves state, city and neighborhood from ViaCEP response by matching
 * against platform_states, platform_cities and platform_neighborhoods.
 * Returns data only when state, city AND neighborhood exist on the platform;
 * otherwise returns notAvailable so the caller can clear CEP and show a message.
 */
export async function resolveFormDataFromCep(
  cepMasked: string
): Promise<ResolveCepResult> {
  const viaCep = await fetchAddressByCEP(cepMasked);
  if (viaCep === null) return null;
  if ("erro" in viaCep && viaCep.erro === true) return { ok: false, cepNotFound: true };

  const uf = viaCep.uf?.trim().toUpperCase() ?? "";
  const localidade = viaCep.localidade?.trim() ?? "";
  const bairro = viaCep.bairro?.trim() ?? "";
  const logradouro = viaCep.logradouro?.trim() ?? "";

  const { states, error: statesError } = await listStates();
  if (statesError || !states.length) return { ok: false, notAvailable: true };

  const state = states.find((s) => (s.abbreviation ?? "").toUpperCase() === uf);
  if (!state) return { ok: false, notAvailable: true };

  const { cities, error: citiesError } = await listCitiesByState(state.id);
  if (citiesError || !cities.length) return { ok: false, notAvailable: true };

  const ibgeNum = viaCep.ibge ? Number.parseInt(viaCep.ibge, 10) : NaN;
  const city =
    !Number.isNaN(ibgeNum) && ibgeNum > 0
      ? cities.find((c) => c.ibge_code === ibgeNum)
      : null;
  const cityByName =
    city ?? cities.find((c) => normalizeForMatch(c.name) === normalizeForMatch(localidade));
  if (!cityByName) return { ok: false, notAvailable: true };

  const { neighborhoods, error: neighborhoodsError } = await listNeighborhoodsByCity(cityByName.id);
  if (neighborhoodsError || !neighborhoods.length) return { ok: false, notAvailable: true };

  const neighborhoodNorm = normalizeForMatch(bairro);
  const neighborhood = neighborhoods.find(
    (n) => normalizeForMatch(n.name) === neighborhoodNorm
  );
  if (!neighborhood) return { ok: false, notAvailable: true };

  return {
    ok: true,
    data: {
      address_street: logradouro || "",
      address_state_id: state.id,
      address_state: state.abbreviation ?? uf,
      address_city_id: cityByName.id,
      address_city: cityByName.name ?? localidade,
      address_neighborhood_id: neighborhood.id,
      address_neighborhood: neighborhood.name ?? bairro,
    },
  };
}
