export type PaymentsApiError = {
  code: string;
  message: string;
  field?: string;
  retryAfterSeconds?: number;
};

export type PaymentsApiResult<T> = {
  data: T | null;
  error: PaymentsApiError | null;
};
