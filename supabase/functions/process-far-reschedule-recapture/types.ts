export type FarRecaptureBody = {
  schedule_id?: string;
  contracted_service_id?: string;
};

export type FarRecapturePrepareResult = {
  outcome: string;
  scheduleId: string;
  contractedServiceId: string;
  providerTransactionId: string;
  gatewayReferenceCode: string | null;
  refundAmount: string;
  alreadySubmitted: boolean;
  refundSubmitStatus: string | null;
  newScheduleId?: string | null;
};

export type FarRecaptureCommitResult = {
  outcome: string;
  scheduleId: string;
  newScheduleId: string;
  contractedServiceId: string;
  refundAmount: string;
};

export type FarRecaptureErrorCode =
  | "SCHEDULE_NOT_FOUND"
  | "SERVICE_NOT_FOUND"
  | "INVALID_SCHEDULE_STATE"
  | "FAR_RECAPTURE_NOT_PENDING"
  | "TRANSACTION_NOT_FOUND"
  | "INVALID_SERVICE_STATUS"
  | "INVALID_REFUND_AMOUNT";

export const FAR_RECAPTURE_ERROR_CODES: readonly FarRecaptureErrorCode[] = [
  "SCHEDULE_NOT_FOUND",
  "SERVICE_NOT_FOUND",
  "INVALID_SCHEDULE_STATE",
  "FAR_RECAPTURE_NOT_PENDING",
  "TRANSACTION_NOT_FOUND",
  "INVALID_SERVICE_STATUS",
  "INVALID_REFUND_AMOUNT",
];

export function mapFarRecaptureRpcError(message: string): FarRecaptureErrorCode | null {
  return FAR_RECAPTURE_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}
