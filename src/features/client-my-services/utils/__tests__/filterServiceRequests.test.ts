import { describe, it, expect } from "vitest";
import { filterServiceRequests } from "../filterServiceRequests";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";
import type { ServiceRequestsFilterState } from "../../types/client-my-services.types";

function makeModel(overrides: Partial<ServiceRequestCardModel>): ServiceRequestCardModel {
  return {
    id: "id",
    title: "Eletricista",
    description: "Troca de tomadas",
    descriptionPreview: "Troca de tomadas",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    address: { neighborhood: "Centro", cityName: "Florianópolis" },
    service: { title: "Eletricista", slug: "eletricista" },
    photoPaths: [],
    ...overrides,
  };
}

describe("filterServiceRequests", () => {
  const openItem = makeModel({ id: "1", listPhase: "negotiation", statusTabId: "negotiation" });
  const inProgressItem = makeModel({
    id: "2",
    listPhase: "in_progress",
    statusTabId: "in_progress",
  });

  it("returns all items when statusTabId is all", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem, inProgressItem], filters);
    expect(result).toHaveLength(2);
  });

  it("filters by status tab", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "negotiation",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem, inProgressItem], filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches search against description when title does not match", () => {
    const item = makeModel({
      id: "d-search",
      title: "Outro título",
      description: "Instalação de ventilador",
      descriptionPreview: "Instalação de ventilador",
    });
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "ventilador",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    expect(filterServiceRequests([item], filters)).toHaveLength(1);
  });

  it("filters by search query on title", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "Eletricista",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem, inProgressItem], filters);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by city name", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: "Florianópolis",
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem], filters);
    expect(result).toHaveLength(1);
  });

  it("filters by neighborhood name", () => {
    const trindadeItem = makeModel({
      id: "3",
      address: { neighborhood: "Trindade", cityName: "Florianópolis" },
    });
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: "Trindade",
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem, trindadeItem], filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
    expect(result[0].address?.neighborhood).toBe("Trindade");
  });

  it("search is accent-insensitive and case-insensitive", () => {
    const itemWithAccent = makeModel({
      id: "4",
      title: "Serviço de encanamento",
      description: "Instalação e manutenção",
      service: { title: "Encanador", slug: "encanador" },
    });
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "encanamento",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([itemWithAccent], filters);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Serviço de encanamento");

    const filtersNoAccent: ServiceRequestsFilterState = {
      ...filters,
      searchQuery: "encanador",
    };
    const result2 = filterServiceRequests([itemWithAccent], filtersNoAccent);
    expect(result2).toHaveLength(1);
    expect(result2[0].service?.title).toBe("Encanador");
  });

  it("focus mode returns only the matching service request when focusServiceRequestId is set", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "negotiation",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem, inProgressItem], filters, {
      focusServiceRequestId: "2",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("focus mode returns empty when id does not exist", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem], filters, {
      focusServiceRequestId: "missing",
    });
    expect(result).toHaveLength(0);
  });

  it("matches category filter by service title when slug differs", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: "Eletricista",
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    expect(filterServiceRequests([openItem], filters)).toHaveLength(1);
  });

  it("matches category filter by service slug", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: "eletricista",
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem], filters);
    expect(result).toHaveLength(1);
  });

  it("excludes items created before dateFrom", () => {
    const item = makeModel({
      id: "early",
      createdAt: "2025-01-05T12:00:00Z",
    });
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: "2025-01-10",
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    expect(filterServiceRequests([item], filters)).toHaveLength(0);
    expect(
      filterServiceRequests([item], { ...filters, dateFrom: "2025-01-01" })
    ).toHaveLength(1);
  });

  it("trims focusServiceRequestId when matching", () => {
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
    };
    const result = filterServiceRequests([openItem], filters, {
      focusServiceRequestId: "  1  ",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by date range end boundary", () => {
    const item = makeModel({
      id: "d1",
      createdAt: "2025-06-15T12:00:00Z",
    });
    const filters: ServiceRequestsFilterState = {
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: "2025-06-10",
      hasProposals: null,
      hasImages: null,
    };
    expect(filterServiceRequests([item], filters)).toHaveLength(0);

    const ok = filterServiceRequests([item], {
      ...filters,
      dateTo: "2025-06-20",
    });
    expect(ok).toHaveLength(1);
  });

  it("filters by proposals and images flags", () => {
    const withAll = makeModel({ id: "p1", proposalCount: 2, photoPaths: ["a"] });
    const empty = makeModel({ id: "p2", proposalCount: 0, photoPaths: [] });
    const baseFilters = (partial: Partial<ServiceRequestsFilterState>): ServiceRequestsFilterState => ({
      statusTabId: "all",
      searchQuery: "",
      categoryId: null,
      cityName: null,
      neighborhoodName: null,
      dateFrom: null,
      dateTo: null,
      hasProposals: null,
      hasImages: null,
      ...partial,
    });

    expect(
      filterServiceRequests([withAll, empty], baseFilters({ hasProposals: true }))
    ).toEqual([withAll]);
    expect(
      filterServiceRequests([withAll, empty], baseFilters({ hasProposals: false }))
    ).toEqual([empty]);
    expect(
      filterServiceRequests([withAll, empty], baseFilters({ hasImages: true }))
    ).toEqual([withAll]);
    expect(
      filterServiceRequests([withAll, empty], baseFilters({ hasImages: false }))
    ).toEqual([empty]);
  });
});
