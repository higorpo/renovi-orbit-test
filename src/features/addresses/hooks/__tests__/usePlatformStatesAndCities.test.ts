import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  usePlatformStates,
  usePlatformCities,
  usePlatformNeighborhoods,
} from "../usePlatformStatesAndCities";
import * as statesAndCitiesApi from "../../api/statesAndCities.api";

vi.mock("../../api/statesAndCities.api", () => ({
  listStates: vi.fn(),
  listCitiesByState: vi.fn(),
  listNeighborhoodsByCity: vi.fn(),
}));

const listStates = vi.mocked(statesAndCitiesApi.listStates);
const listCitiesByState = vi.mocked(statesAndCitiesApi.listCitiesByState);
const listNeighborhoodsByCity = vi.mocked(statesAndCitiesApi.listNeighborhoodsByCity);

const mockStates = [
  {
    id: "state-1",
    ibge_code: 35,
    name: "São Paulo",
    abbreviation: "SP",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];
const mockCities = [
  {
    id: "city-1",
    state_id: "state-1",
    ibge_code: 3550308,
    name: "São Paulo",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];
const mockNeighborhoods = [
  {
    id: "neighborhood-1",
    city_id: "city-1",
    name: "Bela Vista",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("usePlatformStatesAndCities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listStates.mockResolvedValue({ states: mockStates, error: null });
    listCitiesByState.mockResolvedValue({ cities: mockCities, error: null });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: mockNeighborhoods,
      error: null,
    });
  });

  describe("usePlatformStates", () => {
    it("returns states and loading false after success", async () => {
      const { result } = renderHook(() => usePlatformStates(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.states).toEqual(mockStates);
      expect(result.current.error).toBeNull();
      expect(listStates).toHaveBeenCalledTimes(1);
    });

    it("returns error when listStates throws", async () => {
      listStates.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => usePlatformStates(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.states).toEqual([]);
      expect(result.current.error).toBe("Network error");
    });

    it("returns empty states when listStates returns error", async () => {
      listStates.mockResolvedValue({ states: [], error: "API error" });
      const { result } = renderHook(() => usePlatformStates(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.states).toEqual([]);
      expect(result.current.error).toBe("API error");
    });
  });

  describe("usePlatformCities", () => {
    it("does not fetch when stateId is null", async () => {
      const { result } = renderHook(
        () => usePlatformCities(null),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.cities).toEqual([]);
      expect(listCitiesByState).not.toHaveBeenCalled();
    });

    it("fetches cities when stateId is provided", async () => {
      const { result } = renderHook(
        () => usePlatformCities("state-1"),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.cities).toEqual(mockCities);
      expect(listCitiesByState).toHaveBeenCalledWith("state-1");
    });

    it("returns error when listCitiesByState throws", async () => {
      listCitiesByState.mockRejectedValue(new Error("Failed"));
      const { result } = renderHook(
        () => usePlatformCities("state-1"),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.cities).toEqual([]);
      expect(result.current.error).toBe("Failed");
    });
  });

  describe("usePlatformNeighborhoods", () => {
    it("does not fetch when cityId is null", async () => {
      const { result } = renderHook(
        () => usePlatformNeighborhoods(null),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.neighborhoods).toEqual([]);
      expect(listNeighborhoodsByCity).not.toHaveBeenCalled();
    });

    it("fetches neighborhoods when cityId is provided", async () => {
      const { result } = renderHook(
        () => usePlatformNeighborhoods("city-1"),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.neighborhoods).toEqual(mockNeighborhoods);
      expect(listNeighborhoodsByCity).toHaveBeenCalledWith("city-1");
    });

    it("returns error when listNeighborhoodsByCity throws", async () => {
      listNeighborhoodsByCity.mockRejectedValue(new Error("Failed"));
      const { result } = renderHook(
        () => usePlatformNeighborhoods("city-1"),
        { wrapper: createWrapper() }
      );
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.neighborhoods).toEqual([]);
      expect(result.current.error).toBe("Failed");
    });
  });
});
