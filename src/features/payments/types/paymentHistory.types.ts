export type PaymentHistoryScheduleState =
  | "PAID"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_REQUESTED";

export type ClientPaymentTransaction = {
  scheduleId: string;
  contractedServiceId: string;
  amountPaid: number;
  serviceAmount: number;
  installmentNumber: number;
  paidAt: string;
  refundedAmount: number | null;
  refundedAt: string | null;
  state: PaymentHistoryScheduleState;
  isDisputed: boolean;
  createdAt: string;
};

export type ProviderPaymentReceivable = {
  scheduleId: string;
  contractedServiceId: string;
  amountReceivedAtCapture: number;
  netAmountReceived: number;
  receivedAt: string;
  refundedAmount: number | null;
  refundedAt: string | null;
  state: PaymentHistoryScheduleState;
  isDisputed: boolean;
  createdAt: string;
};
