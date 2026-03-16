/**
 * Request-quote feature — Public API.
 * Do not import from internal paths outside this feature.
 */

export { RequestQuote } from "./components/RequestQuote/RequestQuote";
export { useServiceSchema } from "./hooks/useServiceSchema";
export type { UseServiceSchemaParams } from "./hooks/useServiceSchema";
export { useServiceRequestPhotoUrls } from "./hooks/useServiceRequestPhotoUrls";

export type {
  Service,
  ServiceWithChildren,
  ServiceSchemaResult,
  GenerateSmartDescriptionPayload,
  GenerateSmartDescriptionResponse,
} from "./types/request-quote.types";

export { getServiceBySlug, getServiceById, listServicesForRequestQuote } from "./api/services.api";
export {
  getServiceCardStyle,
  SERVICE_COLOR_KEYS,
} from "./utils/serviceCardStyle";
export type {
  ServiceCardStyle,
  ServiceStyleInput,
  ServiceColorKey,
} from "./utils/serviceCardStyle";
export { getFormById } from "./api/forms.api";
export { createServiceRequest, uploadPhotosForRequest } from "./api/serviceRequests.api";
export { invokeGenerateSmartDescription } from "./api/smartDescription.api";
