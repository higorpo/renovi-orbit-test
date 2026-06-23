/**
 * Addresses feature — Public API.
 *
 * CRUD for client addresses (used e.g. in request-quote flow).
 * Only import from this file from outside the feature.
 */

export {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "./api/addresses.api";
export {
  listStates,
  listCitiesByState,
  listNeighborhoodsByCity,
  searchCities,
  getNeighborhoodsByIds,
} from "./api/statesAndCities.api";
export type {
  ClientAddress,
  ClientAddressWithRelations,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
  PlatformState,
  PlatformCity,
  PlatformNeighborhood,
  AddressSelection,
  AddressSelectionExisting,
  AddressSelectionNew,
  AddressLocation,
  ResolveAddressResult,
} from "./types/addresses.types";
export type {
  ListStatesResult,
  ListCitiesResult,
  ListNeighborhoodsResult,
  CitySearchItem,
  SearchCitiesResult,
  NeighborhoodWithCity,
  GetNeighborhoodsByIdsResult,
} from "./api/statesAndCities.api";
export {
  addressFormSchema,
  defaultAddressFormData,
} from "./types/addressForm.validation";
export type { AddressFormData } from "./types/addressForm.validation";
export { resolveAddress } from "./utils/resolveAddress";
export { resolveFormDataFromCep } from "./utils/resolveFormDataFromCep";
export type { ResolveCepResult } from "./utils/resolveFormDataFromCep";
export { addressToFormData } from "./utils/addressToFormData";
export { useAddressSelection } from "./hooks/useAddressSelection";
export {
  useAddressesList,
  ADDRESSES_LIST_QUERY_KEY,
} from "./hooks/useAddressesList";
export {
  useSetDefaultAddress,
  useDeleteAddress,
} from "./hooks/useAddressMutations";
export {
  usePlatformStates,
  usePlatformCities,
  usePlatformNeighborhoods,
} from "./hooks/usePlatformStatesAndCities";
export { AddressSelectionStep } from "./components/AddressSelectionStep/AddressSelectionStep";
export { LocationPreviewMap } from "./components/LocationPreviewMap/LocationPreviewMap";
export type { LocationPreviewMapProps } from "./components/LocationPreviewMap/LocationPreviewMap";
export { AddressCard } from "./components/AddressCard/AddressCard";
export { AddressFormDialog } from "./components/AddressFormDialog/AddressFormDialog";
export { DeleteAddressDialog } from "./components/DeleteAddressDialog/DeleteAddressDialog";
export { AddressesSection } from "./components/AddressesSection/AddressesSection";
