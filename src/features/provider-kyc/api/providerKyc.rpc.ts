/**
 * Provider KYC RPC / Edge Function names — local to provider-kyc.
 * Same string values as the payment backend; do not import payments internals.
 */
export const PROVIDER_KYC_RPC = {
  submitProviderKyc: "payment_submit_provider_kyc",
  createUploadSession: "payment_create_provider_kyc_upload_session",
  registerUploadPath: "payment_register_provider_kyc_upload_path",
} as const;

export const PROVIDER_KYC_EDGE = {
  dispatchKycEmail: "dispatch-kyc-email",
} as const;

export type ProviderKycRpcName = (typeof PROVIDER_KYC_RPC)[keyof typeof PROVIDER_KYC_RPC];
export type ProviderKycEdgeName = (typeof PROVIDER_KYC_EDGE)[keyof typeof PROVIDER_KYC_EDGE];
