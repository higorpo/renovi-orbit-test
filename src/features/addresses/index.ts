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
} from "./api/addresses.api";
export {
  listStates,
  listCitiesByState,
  listNeighborhoodsByCity,
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
  ResolveAddressResult,
} from "./types/addresses.types";
export type {
  ListStatesResult,
  ListCitiesResult,
  ListNeighborhoodsResult,
} from "./api/statesAndCities.api";
export {
  addressFormSchema,
  defaultAddressFormData,
} from "./types/addressForm.validation";
export type { AddressFormData } from "./types/addressForm.validation";
export { resolveAddress } from "./utils/resolveAddress";
export { useAddressSelection } from "./hooks/useAddressSelection";
export { AddressSelectionStep } from "./components/AddressSelectionStep/AddressSelectionStep";
