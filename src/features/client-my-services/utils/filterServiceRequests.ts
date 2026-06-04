import { tabIncludesStatus } from "../constants/statusTabs";
import type { ServiceRequestCardModel } from "../types/client-my-services.types";
import type { ServiceRequestsFilterState } from "../types/client-my-services.types";
import { formatLocationDisplay } from "./locationDisplay";
import { normalizedIncludes } from "./normalizeForSearch";

function matchesSearch(model: ServiceRequestCardModel, query: string): boolean {
  if (!query.trim()) return true;
  const title = model.title;
  const desc = model.description ?? "";
  const location = formatLocationDisplay(model.address);
  const category = model.service?.title ?? "";
  return (
    normalizedIncludes(title, query) ||
    normalizedIncludes(desc, query) ||
    normalizedIncludes(location, query) ||
    normalizedIncludes(category, query)
  );
}

function matchesStatusTab(
  model: ServiceRequestCardModel,
  statusTabId: string,
): boolean {
  return tabIncludesStatus(
    statusTabId as import("../constants/statusTabs").StatusTabId,
    model.listPhase,
  );
}

function matchesCategory(
  model: ServiceRequestCardModel,
  categoryId: string | null
): boolean {
  if (!categoryId) return true;
  return model.service?.slug === categoryId || model.service?.title === categoryId;
}

function matchesCity(
  model: ServiceRequestCardModel,
  cityName: string | null
): boolean {
  if (!cityName?.trim()) return true;
  return (
    model.address?.cityName?.toLowerCase() === cityName.trim().toLowerCase()
  );
}

function matchesNeighborhood(
  model: ServiceRequestCardModel,
  neighborhoodName: string | null
): boolean {
  if (!neighborhoodName?.trim()) return true;
  return (
    model.address?.neighborhood?.toLowerCase() ===
    neighborhoodName.trim().toLowerCase()
  );
}

function matchesDateRange(
  model: ServiceRequestCardModel,
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  if (!dateFrom && !dateTo) return true;
  const created = new Date(model.createdAt).getTime();
  if (dateFrom && created < new Date(dateFrom).getTime()) return false;
  if (dateTo && created > new Date(dateTo + "T23:59:59").getTime())
    return false;
  return true;
}

function matchesHasProposals(
  model: ServiceRequestCardModel,
  hasProposals: boolean | null
): boolean {
  if (hasProposals === null) return true;
  const count = model.proposalCount ?? 0;
  return hasProposals ? count > 0 : count === 0;
}

function matchesHasImages(
  model: ServiceRequestCardModel,
  hasImages: boolean | null
): boolean {
  if (hasImages === null) return true;
  const has = (model.photoPaths?.length ?? 0) > 0;
  return hasImages ? has : !has;
}

export interface FilterServiceRequestsOptions {
  /** When set, only this request is shown (deep link from orçamentos). */
  focusServiceRequestId?: string | null;
}

/**
 * Filter card models by the current filter state.
 */
export function filterServiceRequests(
  items: ServiceRequestCardModel[],
  filters: ServiceRequestsFilterState,
  options?: FilterServiceRequestsOptions
): ServiceRequestCardModel[] {
  const focusId = options?.focusServiceRequestId?.trim() ?? null;
  if (focusId) {
    const target = items.find((m) => m.id === focusId);
    return target ? [target] : [];
  }

  return items.filter(
    (model) =>
      matchesStatusTab(model, filters.statusTabId) &&
      matchesSearch(model, filters.searchQuery) &&
      matchesCategory(model, filters.categoryId) &&
      matchesCity(model, filters.cityName) &&
      matchesNeighborhood(model, filters.neighborhoodName) &&
      matchesDateRange(model, filters.dateFrom, filters.dateTo) &&
      matchesHasProposals(model, filters.hasProposals) &&
      matchesHasImages(model, filters.hasImages)
  );
}
