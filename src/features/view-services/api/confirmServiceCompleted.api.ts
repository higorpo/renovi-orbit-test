/**
 * Re-export payment lifecycle APIs from the payments feature (CHK-040).
 * Import the API module directly to avoid pulling the full payments public barrel.
 */
export {
  confirmServiceCompleted,
  type ConfirmServiceCompletedSuccess,
  type ConfirmServiceCompletedResult,
} from "@/features/payments/api/serviceLifecycle.api";
