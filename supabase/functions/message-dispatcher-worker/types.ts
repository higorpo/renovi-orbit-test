/** Per-device push delivery row from checkout RPC (design §5.3). */
export interface CheckoutDeliveryDto {
  delivery_id: string;
  device_id: string;
  fcm_token_snapshot: string;
}

/** Single dispatch item returned by message_dispatcher_checkout_batch. */
export interface CheckoutDispatchDto {
  id: string;
  profile_id: string;
  channel: "email" | "push";
  template_key: string;
  template_variables: Record<string, unknown>;
  correlation_id: string;
  status: string;
  locked_until: string;
  locked_by: string;
  recipient_email: string | null;
  deliveries: CheckoutDeliveryDto[];
}

/** Worker HTTP response envelope (design §5.5). */
export interface WorkerRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  /** Items left in batch when wall-clock budget was reached (task 107). */
  skipped?: number;
  wall_clock_ms?: number;
  budget_exceeded?: boolean;
}
