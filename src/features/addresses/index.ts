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
} from "./api/addresses.api";
