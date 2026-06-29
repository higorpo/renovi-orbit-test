export type SavedPaymentToken = {
  id: string;
  card_number_masked: string;
  card_brand: string;
  expiry_month: number;
  expiry_year: number;
  state: string;
};

export type InstallmentOption = {
  installment_number: number;
  applicable_rate_pct: number;
  total_with_fees: number;
  installment_amount: number;
};

export type InstallmentHmacPayload = {
  proposal_id: string;
  service_id: string;
  base_amount: number;
  card_brand: string;
  installment_options: InstallmentOption[];
  computed_at: string;
  expires_at: string;
};

export type InstallmentOptionsResponse = {
  installment_options: InstallmentOption[];
  installment_selection_hmac: string;
  installment_hmac_payload: InstallmentHmacPayload;
  expires_at: string;
  computed_at?: string;
};

export type SavedCardSelection = {
  paymentTokenId: string;
  cardBrand: string;
};

export type InstallmentSelection = {
  installmentNumber: number;
  installmentSelectionHmac: string;
  installmentHmacPayload: InstallmentHmacPayload;
  installmentAmount: number;
  totalWithFees: number;
  installmentOptions: InstallmentOption[];
  computedAt: string;
  expiresAt: string;
};
