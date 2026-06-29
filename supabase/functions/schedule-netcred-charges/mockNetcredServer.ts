import type {
  CreateChargeInput,
  CreateChargeResult,
  GatewayTransactionState,
  GetTransactionInput,
  GetTransactionResult,
} from "../_shared/payment/types.ts";

export type MockNetCredScenario =
  | "paid"
  | "in_analysis"
  | "retryable"
  | "terminal";

type StoredTransaction = {
  referenceCode: string;
  transactionState: GatewayTransactionState;
  chargeId: string;
  transactionId: string;
  paidAmount: string;
};

export class MockNetCredServer {
  private scenario: MockNetCredScenario = "paid";
  private transactions = new Map<string, StoredTransaction>();
  private createChargeCalls = 0;
  private server: Deno.HttpServer | null = null;
  private port = 0;

  setScenario(scenario: MockNetCredScenario): void {
    this.scenario = scenario;
  }

  getCreateChargeCallCount(): number {
    return this.createChargeCalls;
  }

  createCharge = async (input: CreateChargeInput): Promise<CreateChargeResult> => {
    this.createChargeCalls += 1;
    const referenceCode = input.referenceCode;

    if (this.scenario === "retryable") {
      return {
        success: false,
        error: { code: "RETRYABLE", message: "Gateway timeout", originalCode: "TIMEOUT" },
      };
    }

    if (this.scenario === "terminal") {
      const tx: StoredTransaction = {
        referenceCode,
        transactionState: "REJECTED",
        chargeId: `chg-${referenceCode}`,
        transactionId: `tx-${referenceCode}`,
        paidAmount: "0.00",
      };
      this.transactions.set(referenceCode, tx);
      return {
        success: false,
        transactionState: "REJECTED",
        chargeId: tx.chargeId,
        transactionId: tx.transactionId,
        error: { code: "TERMINAL", message: "Card rejected", originalCode: "REJECTED" },
      };
    }

    const transactionState = this.scenario === "in_analysis" ? "IN_ANALYSIS" : "PAID";
    const tx: StoredTransaction = {
      referenceCode,
      transactionState,
      chargeId: `chg-${referenceCode}`,
      transactionId: `tx-${referenceCode}`,
      paidAmount: input.amount,
    };
    this.transactions.set(referenceCode, tx);

    return {
      success: true,
      transactionState,
      chargeId: tx.chargeId,
      transactionId: tx.transactionId,
    };
  };

  getTransaction = async (
    input: GetTransactionInput,
  ): Promise<GetTransactionResult | null> => {
    const tx = this.transactions.get(input.referenceCode);
    if (!tx) {
      return null;
    }

    return {
      referenceCode: tx.referenceCode,
      transactionState: tx.transactionState,
      chargeId: tx.chargeId,
      transactionId: tx.transactionId,
      paidAmount: tx.paidAmount,
    };
  };

  /** Simulates TRANSACTION_CAPTURE webhook promoting IN_ANALYSIS → PAID. */
  captureTransaction(referenceCode: string): void {
    const tx = this.transactions.get(referenceCode);
    if (!tx) {
      throw new Error(`transaction_not_found:${referenceCode}`);
    }
    tx.transactionState = "PAID";
  }

  async listen(): Promise<number> {
    this.server = Deno.serve({ port: 0, onListen: ({ port }) => { this.port = port; } }, (req) => {
      if (req.method !== "POST") {
        return new Response("method_not_allowed", { status: 405 });
      }

      return req.json().then((body: { operationName?: string; variables?: Record<string, unknown> }) => {
        const op = body.operationName ?? "";

        if (op.includes("chargeCreate") || JSON.stringify(body).includes("chargeCreate")) {
          const referenceCode = String(
            (body.variables as { input?: { referenceCode?: string } })?.input?.referenceCode
              ?? "unknown",
          );
          return this.createCharge({
            referenceCode,
            amount: "1024.29",
            paymentMethod: {
              type: "CREDIT_CARD",
              installmentNumber: 1,
              paymentProfileId: "403137",
              paymentToken: "tok",
            },
            payoutRule: {
              providerAccount: {
                netcredCompanyId: "1048",
                netcredBankAccountId: "2053",
              },
              ruleItems: [],
            },
          }).then((result) =>
            Response.json({
              data: {
                chargeCreate: {
                  charge: {
                    id: result.chargeId,
                    referenceCode,
                    transactions: {
                      edges: [{
                        node: {
                          id: result.transactionId,
                          transactionState: result.transactionState ?? "PAID",
                          paidAmount: "1024.29",
                        },
                      }],
                    },
                  },
                },
              },
            })
          );
        }

        return Response.json({ data: { transactions: { edges: [] } } });
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    return this.port;
  }

  close(): void {
    this.server?.shutdown();
    this.server = null;
  }
}
