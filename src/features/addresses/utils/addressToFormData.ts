import type { ClientAddressWithRelations } from "../types/addresses.types";
import type { AddressFormData } from "../types/addressForm.validation";
import { defaultAddressFormData } from "../types/addressForm.validation";
import { maskCEP } from "@/lib/masks";

/**
 * Map client address (with relations) to address form data for editing.
 * Neighborhood ID is left empty if not resolved; caller may run neighborhood lookup.
 */
export function addressToFormData(addr: ClientAddressWithRelations): AddressFormData {
  return {
    ...defaultAddressFormData,
    address_label: addr.label,
    address_zip: maskCEP(addr.zip_code),
    address_street: addr.street,
    address_number: addr.number,
    address_complement: addr.complement ?? "",
    address_neighborhood: addr.neighborhood,
    address_neighborhood_id: "",
    address_state_id: addr.state_id,
    address_state: addr.platform_states?.abbreviation ?? "",
    address_city_id: addr.city_id,
    address_city: addr.platform_cities?.name ?? "",
  };
}
