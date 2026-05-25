import {
  PROVIDER_HTTP_TIMEOUT_MS,
} from "../_shared/providerHttp.ts";

/** Default checkout batch size — matches MAX to maximize throughput per invocation. */
export const DEFAULT_CHECKOUT_LIMIT = 50;

/** Hard cap for p_limit per RPC contract. */
export const MAX_CHECKOUT_LIMIT = 50;

/** Target worker wall clock for p95 tuning (design §5.5, task 107). */
export const WORKER_WALL_CLOCK_BUDGET_MS = 60_000;

/** Hard ceiling before Edge/platform timeout (design §5.5). */
export const WORKER_WALL_CLOCK_HARD_LIMIT_MS = 120_000;

/** Shared provider HTTP budget (task 60). */
export { PROVIDER_HTTP_TIMEOUT_MS };
