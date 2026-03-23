import { describe, it, expect } from "vitest";
import { filterServiceRequests } from "../filterServiceRequests";
import type { ServiceRequestCardModel } from "../../types/service-request-view.types";
import type { ServiceRequestsFilterState } from "../../types/service-request-view.types";

function makeModel(overrides: Partial<ServiceRequestCardModel>): ServiceRequestCardModel {
  return {
    id: "id",
    title: "Eletricista",
    description: "Troca de tomadas",
    descriptionPreview: "Troca de tomadas",
    status: "open",
    statusTabId: "waiting_proposals",
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    address: { neighborhood: "Centro", cityName: "Florianópolis" },
    service: { title: "Eletricista", slug: "eletricista" },
    photoPaths: [],
    ...overrides,
  };
}

describe("filterServiceRequests", () => {
  const openItem = makeModel({ id: "1", status: "open", statusTabId: "waiting_proposals" });
  const inProgressItem = makeModel({
    id: "2",
    status: "in_progress",
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
      statusTabId: "waiting_proposals",
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
      statusTabId: "waiting_proposals",
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
});
