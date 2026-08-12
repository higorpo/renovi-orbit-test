// Re-export barrel — canonical implementations are in the focused api files below.
export {
  getProviderPrivateProfile,
  updateProviderPrivateProfile,
} from "./providerPrivateProfile.api";
export type {
  ProviderPrivateProfile,
  GetProviderPrivateResult,
  UpdateProviderPrivateParams,
} from "./providerPrivateProfile.api";

export {
  slugify,
  getProviderPublicProfile,
  updateProviderPublicProfile,
} from "./providerPublicProfile.api";
export type {
  ProviderPublicProfile,
  ProviderPublicProfileWithServiceArea,
  GetProviderPublicResult,
  UpdateProviderPublicParams,
} from "./providerPublicProfile.api";

export {
  searchServices,
  getServicesByIds,
  listOfferedServices,
  setOfferedServices,
} from "./offeredServices.api";
export type { ServiceOption } from "./offeredServices.api";

export {
  listPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  reorderPortfolioItems,
  getPortfolioImageSignedUrl,
} from "./portfolio.api";
export type {
  ProviderPortfolioItem,
  CreatePortfolioItemParams,
  UpdatePortfolioItemParams,
} from "./portfolio.api";
