import { useQuery } from "@tanstack/react-query";
import {
  listStates,
  listCitiesByState,
  listNeighborhoodsByCity,
} from "../api/statesAndCities.api";
import type {
  PlatformState,
  PlatformCity,
  PlatformNeighborhood,
} from "../types/addresses.types";

const STATES_QUERY_KEY = ["platform-states"] as const;
const CITIES_QUERY_KEY = "platform-cities" as const;
const NEIGHBORHOODS_QUERY_KEY = "platform-neighborhoods" as const;

export function usePlatformStates(): {
  states: PlatformState[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: STATES_QUERY_KEY,
    queryFn: async () => {
      const res = await listStates();
      if (res.error) throw new Error(res.error);
      return res.states;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    states: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function usePlatformCities(stateId: string | null): {
  cities: PlatformCity[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: [CITIES_QUERY_KEY, stateId],
    queryFn: async () => {
      if (!stateId) return [];
      const res = await listCitiesByState(stateId);
      if (res.error) throw new Error(res.error);
      return res.cities;
    },
    enabled: !!stateId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    cities: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function usePlatformNeighborhoods(cityId: string | null): {
  neighborhoods: PlatformNeighborhood[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: [NEIGHBORHOODS_QUERY_KEY, cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const res = await listNeighborhoodsByCity(cityId);
      if (res.error) throw new Error(res.error);
      return res.neighborhoods;
    },
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    neighborhoods: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
