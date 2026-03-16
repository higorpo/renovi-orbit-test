import { tabIncludesStatus } from "../constants/statusTabs";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";
import type { ServiceRequestsFilterState } from "../types/service-request-view.types";
import { formatLocationDisplay } from "./locationDisplay";

function matchesSearch(model: ServiceRequestCardModel, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const title = model.title.toLowerCase();
  const desc = (model.description ?? "").toLowerCase();
  const location = formatLocationDisplay(model.address).toLowerCase();
  const category = model.service?.title.toLowerCase() ?? "";
  return (
    title.includes(q) ||
    desc.includes(q) ||
    location.includes(q) ||
    category.includes(q)
  );
}

function matchesStatusTab(
  model: ServiceRequestCardModel,
  statusTabId: string
): boolean {
  return tabIncludesStatus(
    statusTabId as import("../constants/statusTabs").StatusTabId,
    model.status
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

/**
 * Filter card models by the current filter state.
 */
export function filterServiceRequests(
  items: ServiceRequestCardModel[],
  filters: ServiceRequestsFilterState
): ServiceRequestCardModel[] {
  return items.filter(
    (model) =>
      matchesStatusTab(model, filters.statusTabId) &&
      matchesSearch(model, filters.searchQuery) &&
      matchesCategory(model, filters.categoryId) &&
      matchesCity(model, filters.cityName) &&
      matchesDateRange(model, filters.dateFrom, filters.dateTo) &&
      matchesHasProposals(model, filters.hasProposals) &&
      matchesHasImages(model, filters.hasImages)
  );
}
