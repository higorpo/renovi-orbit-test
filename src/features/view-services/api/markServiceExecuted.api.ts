/**
 * Re-export payment lifecycle APIs from the payments feature (CHK-040).
 * Import the API module directly to avoid pulling the full payments public barrel
 * (which can transitively load DOM-only deps in unit tests).
 */
export {
  markServiceExecuted,
  type MarkServiceExecutedSuccess,
  type MarkServiceExecutedResult,
} from "@/features/payments/api/serviceLifecycle.api";
