import { fetchWithTimeout } from "../providerHttp.ts";
import { withGatewaySpan } from "../observability/gateway-spans.ts";
import {
  getNetCredToken,
  refreshAuthToken,
  resolveIsProduction,
  type NetCredAuthDeps,
} from "./netcred-auth.ts";
import {
  CHARGE_CREATE_MUTATION,
  CHARGE_VOID_MUTATION,
  COMPANIES_BY_DOCUMENT_QUERY,
  PAYMENT_PROFILE_CREATE_MUTATION,
  TRANSACTION_REFUND_MUTATION,
  TRANSACTIONS_BY_REFERENCE_QUERY,
} from "./netcred-graphql.ts";
import { ProviderAuthError } from "./errors.ts";
import { mapToNetCredChargeInput } from "./netcred-charge-mapping.ts";
import {
  buildRetryableError,
  buildTerminalError,
  getPrimaryGatewayError,
  is5xxStatus,
  isNetworkError,
  isReferenceCodeConflict,
  isTerminalGatewayError,
} from "./netcred-charge-errors.ts";
import { resolveNetCredApiBaseUrl } from "./constants.ts";
import { BillingAddressRequiredError } from "./errors.ts";
import type {
  BillingAddress,
  CreateChargeInput,
  CreateChargeResult,
  GatewayTransactionState,
  GetTransactionInput,
  GetTransactionResult,
  ProviderCredentials,
  ProcessWebhookInput,
  ProcessWebhookResult,
  RefundTransactionInput,
  RefundTransactionResult,
  TokenizeCardInput,
  TokenizeCardResult,
  VoidChargeInput,
  VoidChargeResult,
} from "./types.ts";

function resolveGraphqlUrl(override?: string): string {
  if (override) {
    return override.includes("/graphql")
      ? override
      : `${override.replace(/\/+$/, "")}/graphql`;
  }
  return `${resolveNetCredApiBaseUrl((key) => Deno.env.get(key))}/graphql`;
}

type GraphQLError = {
  code?: string | null;
  message?: string | null;
  field?: string | null;
};

type ChargeCreateGraphQLResponse = {
  data?: {
    chargeCreate?: {
      errors?: GraphQLError[] | null;
      charge?: {
        id?: string | null;
        referenceCode?: string | null;
        transactions?: {
          edges?: Array<{
            node?: {
              id?: string | null;
              transactionState?: string | null;
              amount?: string | null;
              paidAmount?: string | null;
            } | null;
          } | null> | null;
        } | null;
      } | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type TransactionsGraphQLResponse = {
  data?: {
    transactions?: {
      edges?: Array<{
        node?: {
          id?: string | null;
          transactionState?: string | null;
          amount?: string | null;
          paidAmount?: string | null;
          charge?: {
            id?: string | null;
            referenceCode?: string | null;
          } | null;
        } | null;
      } | null> | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type PaymentProfileCreateGraphQLResponse = {
  data?: {
    paymentProfileCreate?: {
      errors?: GraphQLError[] | null;
      paymentProfile?: {
        id?: string | null;
        isActive?: boolean | null;
        cardNumber?: string | null;
        brand?: string | null;
        token?: string | null;
      } | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type TransactionRefundGraphQLResponse = {
  data?: {
    transactionRefund?: {
      errors?: GraphQLError[] | null;
      transaction?: {
        id?: string | null;
        transactionState?: string | null;
        refundedAmount?: string | null;
      } | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type ChargeVoidGraphQLResponse = {
  data?: {
    chargeVoid?: {
      errors?: GraphQLError[] | null;
      charge?: {
        id?: string | null;
        chargeStatus?: string | null;
      } | null;
    } | null;
  };
  errors?: GraphQLError[];
};

const AUTH_ERROR_CODES = new Set([
  "UNAUTHENTICATED",
  "JWT_EXPIRED",
  "INVALID_TOKEN",
  "AUTH_FAILURE",
]);

type CompaniesGraphQLResponse = {
  data?: {
    companies?: {
      edges?: Array<{
        node?: {
          id?: string | null;
          document?: string | null;
          companyState?: string | null;
          bankAccounts?: {
            edges?: Array<{
              node?: {
                id?: string | null;
                isActive?: boolean | null;
              } | null;
            } | null> | null;
          } | null;
        } | null;
      } | null> | null;
    } | null;
  };
  errors?: GraphQLError[];
};

const ALREADY_REFUNDED_CODES = new Set([
  "ALREADY_REFUNDED",
  "TRANSACTION_ALREADY_REFUNDED",
]);

function isBillingAddressComplete(
  billingAddress: BillingAddress | undefined | null,
): boolean {
  if (!billingAddress) return false;

  return Boolean(
    billingAddress.street?.trim() &&
      billingAddress.number?.trim() &&
      billingAddress.district?.trim() &&
      billingAddress.city?.trim() &&
      billingAddress.state?.trim() &&
      billingAddress.zipCode?.trim(),
  );
}

function assertBillingAddressInProduction(
  billingAddress: BillingAddress | undefined | null,
  isProduction: boolean,
): void {
  if (!isProduction) return;
  if (!isBillingAddressComplete(billingAddress)) {
    throw new BillingAddressRequiredError();
  }
}

function mapRefundGatewayError(
  code: string,
  message: string,
): RefundTransactionResult {
  const normalizedCode = code.toUpperCase();

  if (
    ALREADY_REFUNDED_CODES.has(normalizedCode) ||
    (normalizedCode === "TRANSACTION_INVALID_REFUND_AMOUNT" &&
      message.toLowerCase().includes("refundable amount (0.00)"))
  ) {
    return {
      success: true,
      error: { code: "ALREADY_REFUNDED", message },
    };
  }

  if (normalizedCode === "TRANSACTION_DOES_NOT_EXIST") {
    return {
      success: false,
      error: { code: "TRANSACTION_NOT_FOUND", message },
    };
  }

  if (normalizedCode === "TRANSACTION_INVALID_REFUND_AMOUNT") {
    return {
      success: false,
      error: { code: "INVALID_REFUND_AMOUNT", message },
    };
  }

  return {
    success: false,
    error: { code: "UNKNOWN", message },
  };
}

export type NetCredAdapterDeps = NetCredAuthDeps & {
  platformBankAccountId: string;
  fetchFn?: typeof fetch;
  graphqlUrl?: string;
};

export class NetCredAdapter {
  constructor(private readonly deps: NetCredAdapterDeps) {}

  async refreshAuthToken(): Promise<void> {
    await getNetCredToken(this.deps);
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    return withGatewaySpan(
      "chargeCreate",
      "netcred",
      () => this.runCreateCharge(input),
      (result) => ({
        http_status: 200,
        transaction_state: result.transactionState,
        outcome: result.success ? "success" : "gateway_error",
        error_code: result.error?.code,
      }),
    );
  }

  private async runCreateCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const chargeInput = mapToNetCredChargeInput(
      input,
      this.deps.platformBankAccountId,
    );

    try {
      const response = await this.graphqlRequestWithAuthRetry<ChargeCreateGraphQLResponse>(
        CHARGE_CREATE_MUTATION,
        { input: chargeInput },
      );

      const chargeCreate = response.data?.chargeCreate;
      const gatewayErrors = chargeCreate?.errors ?? response.errors;

      if (isReferenceCodeConflict(gatewayErrors)) {
        const existing = await this.getTransaction({
          referenceCode: input.referenceCode,
          companyId: String(chargeInput.companyId),
        });
        return this.reconcileFromExisting(existing, input.referenceCode);
      }

      if (gatewayErrors?.length) {
        return this.mapGatewayErrorsToChargeResult(gatewayErrors);
      }

      const charge = chargeCreate?.charge;
      const transaction = charge?.transactions?.edges?.[0]?.node;
      const transactionState = transaction?.transactionState as
        | CreateChargeResult["transactionState"]
        | undefined;

      if (!transactionState) {
        return {
          success: false,
          error: buildRetryableError("chargeCreate returned no transaction state"),
        };
      }

      return this.buildSuccessResult(
        transactionState,
        charge?.id ?? undefined,
        transaction?.id ?? undefined,
      );
    } catch (error) {
      if (isNetworkError(error)) {
        return {
          success: false,
          error: buildRetryableError(
            error instanceof Error ? error.message : "network error",
          ),
        };
      }
      throw error;
    }
  }

  async getTransaction(
    input: GetTransactionInput,
  ): Promise<GetTransactionResult | null> {
    return withGatewaySpan(
      "getTransaction",
      "netcred",
      () => this.runGetTransaction(input),
      (result) => ({
        http_status: 200,
        transaction_state: result?.transactionState,
        outcome: "success",
      }),
    );
  }

  private async runGetTransaction(
    input: GetTransactionInput,
  ): Promise<GetTransactionResult | null> {
    const companyId = Number.parseInt(input.companyId ?? "", 10);

    if (!Number.isFinite(companyId)) {
      throw new Error("GET_TRANSACTION_COMPANY_ID_REQUIRED");
    }

    try {
      const response = await this.graphqlRequestWithAuthRetry<TransactionsGraphQLResponse>(
        TRANSACTIONS_BY_REFERENCE_QUERY,
        {
          companyId,
          referenceCode: input.referenceCode,
          first: 1,
        },
      );

      const node = response.data?.transactions?.edges?.[0]?.node;
      if (!node?.id || !node.transactionState) {
        return null;
      }

      return {
        transactionId: node.id,
        chargeId: node.charge?.id ?? undefined,
        referenceCode: node.charge?.referenceCode ?? input.referenceCode,
        transactionState: node.transactionState as GatewayTransactionState,
        paidAmount: node.paidAmount ?? node.amount ?? undefined,
        refundedAmount: undefined,
      };
    } catch (error) {
      if (isNetworkError(error) || error instanceof ProviderAuthError) {
        throw error;
      }
      return null;
    }
  }

  async tokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult> {
    return withGatewaySpan(
      "tokenizeCard",
      "netcred",
      () => this.runTokenizeCard(input),
      (result) => ({
        http_status: 200,
        outcome: result.isActive ? "success" : "gateway_error",
        error_code: result.errors?.[0]?.code,
      }),
    );
  }

  private async runTokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult> {
    assertBillingAddressInProduction(
      input.billingAddress,
      resolveIsProduction(this.deps.isProduction),
    );

    const companyId = Number.parseInt(input.customerInput.companyId, 10);
    if (!Number.isFinite(companyId)) {
      throw new Error("TOKENIZE_COMPANY_ID_REQUIRED");
    }

    const customerInput: Record<string, unknown> = {
      companyId,
      name: input.cardData.cardholderName,
      documentType: "CPF",
      persist: false,
    };

    if (input.cpf) {
      customerInput.document = input.cpf.replace(/\D/g, "");
    }
    if (input.phone) {
      customerInput.phone = input.phone.replace(/\D/g, "");
    }

    const billingAddressInput: Record<string, string> = {
      street: input.billingAddress.street,
      number: input.billingAddress.number,
      district: input.billingAddress.district,
      city: input.billingAddress.city,
      state: input.billingAddress.state,
      zipCode: input.billingAddress.zipCode.replace(/\D/g, ""),
    };
    if (input.billingAddress.additionalDetails?.trim()) {
      billingAddressInput.additionalDetails = input.billingAddress.additionalDetails.trim();
    }

    try {
      const response = await this.graphqlRequestWithAuthRetry<PaymentProfileCreateGraphQLResponse>(
        PAYMENT_PROFILE_CREATE_MUTATION,
        {
          input: {
            method: "CARD",
            customerInput,
            ccInput: {
              cardNumber: input.cardData.cardNumber.replace(/\D/g, ""),
              expiryMonth: input.cardData.expiryMonth,
              expiryYear: input.cardData.expiryYear,
              securityCode: input.cardData.cvv,
              cardHolderName: input.cardData.cardholderName,
            },
            billingAddressInput,
          },
        },
      );

      const paymentProfileCreate = response.data?.paymentProfileCreate;
      const gatewayErrors = paymentProfileCreate?.errors ?? response.errors;
      const paymentProfile = paymentProfileCreate?.paymentProfile;

      if (gatewayErrors?.length) {
        return {
          isActive: false,
          errors: gatewayErrors.map((error) => ({
            message: error.message ?? "paymentProfileCreate failed",
            code: error.code ?? undefined,
          })),
        };
      }

      return {
        isActive: Boolean(paymentProfile?.isActive),
        paymentProfileId: paymentProfile?.id ?? undefined,
        cardNumberMasked: paymentProfile?.cardNumber ?? undefined,
        cardBrand: paymentProfile?.brand ?? undefined,
        token: paymentProfile?.token ?? undefined,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        return {
          isActive: false,
          errors: [{
            message: error instanceof Error ? error.message : "network error",
          }],
        };
      }
      throw error;
    }
  }

  async voidCharge(input: VoidChargeInput): Promise<VoidChargeResult> {
    return withGatewaySpan(
      "voidCharge",
      "netcred",
      () => this.runVoidCharge(input),
      (result) => ({
        http_status: 200,
        outcome: result.success ? "success" : "gateway_error",
        error_code: result.error?.code,
      }),
    );
  }

  private async runVoidCharge(input: VoidChargeInput): Promise<VoidChargeResult> {
    const chargeId = Number.parseInt(input.chargeId, 10);
    if (!Number.isFinite(chargeId)) {
      return {
        success: false,
        error: buildTerminalError("Invalid chargeId"),
      };
    }

    try {
      const response = await this.graphqlRequestWithAuthRetry<ChargeVoidGraphQLResponse>(
        CHARGE_VOID_MUTATION,
        { input: { chargeId } },
      );

      const chargeVoid = response.data?.chargeVoid;
      const gatewayErrors = chargeVoid?.errors ?? response.errors;

      if (gatewayErrors?.length) {
        const primary = getPrimaryGatewayError(gatewayErrors);
        const message = primary?.message ?? "chargeVoid failed";
        const originalCode = primary?.code ?? undefined;

        if (isTerminalGatewayError(gatewayErrors)) {
          return {
            success: false,
            error: buildTerminalError(message, originalCode),
          };
        }

        return {
          success: false,
          error: buildRetryableError(message),
        };
      }

      return { success: true };
    } catch (error) {
      if (isNetworkError(error)) {
        return {
          success: false,
          error: buildRetryableError(
            error instanceof Error ? error.message : "network error",
          ),
        };
      }
      throw error;
    }
  }

  async processWebhookEvent(
    _input: ProcessWebhookInput,
  ): Promise<ProcessWebhookResult> {
    return {
      handled: false,
      skippedReason: "WEBHOOK_PROCESSING_DELEGATED_TO_EDGE_FUNCTION",
    };
  }

  async refundTransaction(
    input: RefundTransactionInput,
  ): Promise<RefundTransactionResult> {
    return withGatewaySpan(
      "refundTransaction",
      "netcred",
      () => this.runRefundTransaction(input),
      (result) => ({
        http_status: 200,
        outcome: result.success ? "success" : "gateway_error",
        error_code: result.error?.code,
      }),
    );
  }

  private async runRefundTransaction(
    input: RefundTransactionInput,
  ): Promise<RefundTransactionResult> {
    const transactionId = Number.parseInt(input.transactionId, 10);
    if (!Number.isFinite(transactionId)) {
      return {
        success: false,
        error: {
          code: "UNKNOWN",
          message: "Invalid transactionId",
        },
      };
    }

    const refundInput: Record<string, unknown> = {
      transactionId,
      refundReason: "REQUESTED_BY_CUSTOMER",
    };
    if (input.amount) {
      refundInput.amount = input.amount;
    }

    try {
      const response = await this.graphqlRequestWithAuthRetry<TransactionRefundGraphQLResponse>(
        TRANSACTION_REFUND_MUTATION,
        { input: refundInput },
      );

      const transactionRefund = response.data?.transactionRefund;
      const gatewayErrors = transactionRefund?.errors ?? response.errors;

      if (gatewayErrors?.length) {
        const primary = getPrimaryGatewayError(gatewayErrors);
        const message = primary?.message ?? "transactionRefund failed";
        const code = primary?.code ?? "";
        return mapRefundGatewayError(code, message);
      }

      return { success: true };
    } catch (error) {
      if (isNetworkError(error)) {
        return {
          success: false,
          error: {
            code: "UNKNOWN",
            message: error instanceof Error ? error.message : "network error",
          },
        };
      }
      throw error;
    }
  }

  async getProviderCredentials(
    document: string,
  ): Promise<ProviderCredentials | null> {
    return withGatewaySpan(
      "getProviderCredentials",
      "netcred",
      () => this.runGetProviderCredentials(document),
      () => ({
        http_status: 200,
        outcome: "success",
      }),
    );
  }

  private async runGetProviderCredentials(
    document: string,
  ): Promise<ProviderCredentials | null> {
    const normalizedDocument = document.replace(/\D/g, "");
    if (!normalizedDocument) {
      return null;
    }

    try {
      const response = await this.graphqlRequestWithAuthRetry<CompaniesGraphQLResponse>(
        COMPANIES_BY_DOCUMENT_QUERY,
        { document: normalizedDocument },
      );

      const node = response.data?.companies?.edges?.[0]?.node;
      if (!node?.id) {
        return null;
      }

      const activeBankAccount = node.bankAccounts?.edges?.find(
        (edge) => edge?.node?.isActive,
      )?.node;

      return {
        document: node.document ?? normalizedDocument,
        companyId: node.id,
        bankAccountId: activeBankAccount?.id ?? undefined,
        onboardingStatus: node.companyState ?? undefined,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        throw error;
      }
      return null;
    }
  }

  reconcileFromExisting(
    existing: GetTransactionResult | null,
    _referenceCode: string,
  ): CreateChargeResult {
    if (!existing) {
      return {
        success: false,
        error: {
          code: "REFERENCE_CODE_CONFLICT",
          message: "referenceCode conflict with no reconcilable transaction",
          originalCode: "REFERENCE_CODE_CONFLICT_UNRESOLVABLE",
        },
      };
    }

    if (existing.transactionState === "REJECTED") {
      return {
        success: false,
        transactionState: "REJECTED",
        chargeId: existing.chargeId,
        transactionId: existing.transactionId,
        error: buildTerminalError(
          "Existing transaction is REJECTED",
          "REJECTED",
        ),
      };
    }

    if (
      existing.transactionState === "PAID" ||
      existing.transactionState === "IN_ANALYSIS"
    ) {
      return this.buildSuccessResult(
        existing.transactionState,
        existing.chargeId,
        existing.transactionId,
      );
    }

    return {
      success: false,
      transactionState: existing.transactionState as CreateChargeResult["transactionState"],
      chargeId: existing.chargeId,
      transactionId: existing.transactionId,
      error: buildTerminalError(
        `Unreconcilable transaction state ${existing.transactionState}`,
        existing.transactionState,
      ),
    };
  }

  private buildSuccessResult(
    transactionState: NonNullable<CreateChargeResult["transactionState"]>,
    chargeId?: string,
    transactionId?: string,
  ): CreateChargeResult {
    if (transactionState === "REJECTED") {
      return {
        success: false,
        transactionState,
        chargeId,
        transactionId,
        error: buildTerminalError("charge rejected", "REJECTED"),
      };
    }

    return {
      success: true,
      transactionState,
      chargeId,
      transactionId,
    };
  }

  private mapGatewayErrorsToChargeResult(
    errors: GraphQLError[],
  ): CreateChargeResult {
    const primary = getPrimaryGatewayError(errors);
    const message = primary?.message ?? "chargeCreate failed";
    const originalCode = primary?.code ?? undefined;

    if (isTerminalGatewayError(errors)) {
      return {
        success: false,
        transactionState: originalCode === "REJECTED" ? "REJECTED" : undefined,
        error: buildTerminalError(message, originalCode),
      };
    }

    if (originalCode === "INTERNAL_SERVER_ERROR") {
      return { success: false, error: buildRetryableError(message) };
    }

    return { success: false, error: buildRetryableError(message) };
  }

  private isAuthGraphQLError(errors: GraphQLError[] | undefined): boolean {
    if (!errors?.length) return false;
    return errors.some((error) =>
      AUTH_ERROR_CODES.has((error.code ?? "").toUpperCase())
    );
  }

  private async graphqlRequestWithAuthRetry<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    let token = await getNetCredToken(this.deps);

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.graphqlRequest<T>(token, query, variables);

      if (response.status === 401 || this.isAuthGraphQLError(response.bodyErrors)) {
        if (attempt === 0) {
          token = await refreshAuthToken(this.deps);
          continue;
        }
        throw new ProviderAuthError("NETCRED_AUTH_FAILURE");
      }

      return response.data;
    }

    throw new ProviderAuthError("NETCRED_AUTH_FAILURE");
  }

  private async graphqlRequest<T>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<{ status: number; data: T; bodyErrors?: GraphQLError[] }> {
    const fetchFn = this.deps.fetchFn ?? fetch;
    const response = await fetchWithTimeout(
      resolveGraphqlUrl(this.deps.graphqlUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      },
      { fetchFn },
    );

    if (is5xxStatus(response.status)) {
      throw new TypeError(`NetCred GraphQL HTTP ${response.status}`);
    }

    const body = (await response.json()) as T & { errors?: GraphQLError[] };
    const bodyErrors = (body as { errors?: GraphQLError[] }).errors;

    return { status: response.status, data: body, bodyErrors };
  }
}
