export class ProviderAuthError extends Error {
  override name = "ProviderAuthError";

  constructor(message = "NETCRED_AUTH_FAILURE") {
    super(message);
  }
}

export class SandboxCredentialsError extends Error {
  override name = "SandboxCredentialsError";

  constructor(message = "SANDBOX_CREDENTIALS_IN_PRODUCTION") {
    super(message);
  }
}

export class NetCredTokenRefreshTimeoutError extends Error {
  override name = "NetCredTokenRefreshTimeoutError";

  constructor(message = "NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT") {
    super(message);
  }
}

export class BillingAddressRequiredError extends Error {
  override name = "BillingAddressRequiredError";

  constructor(message = "BILLING_ADDRESS_REQUIRED") {
    super(message);
  }
}
