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
export type {
  ClientAddress,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
  AddressSelection,
  AddressSelectionExisting,
  AddressSelectionNew,
  ResolveAddressResult,
} from "./types/addresses.types";
export {
  addressFormSchema,
  defaultAddressFormData,
} from "./types/addressForm.validation";
export type { AddressFormData } from "./types/addressForm.validation";
export { resolveAddress } from "./utils/resolveAddress";
export { useAddressSelection } from "./hooks/useAddressSelection";
export { AddressSelectionStep } from "./components/AddressSelectionStep/AddressSelectionStep";
