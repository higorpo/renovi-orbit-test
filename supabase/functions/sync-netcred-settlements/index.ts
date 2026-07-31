import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import {
  handleSyncNetcredSettlementsRequest,
} from "./handleRequest.ts";
import { createSyncNetcredSettlementsDeps } from "./createDeps.ts";

const logger = createPaymentLogger("sync-netcred-settlements");

servePaymentFunction("sync-netcred-settlements", (req) => {
  try {
    return handleSyncNetcredSettlementsRequest(
      req,
      createSyncNetcredSettlementsDeps(),
    );
  } catch (error) {
    logger.error("settlement_sync_boot_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
