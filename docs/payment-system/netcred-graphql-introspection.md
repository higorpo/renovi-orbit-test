# NetCred GraphQL — introspection snapshot

> Generated: `2026-07-11T14:48:50.872098+00:00`  
> Endpoint: `https://api.sandbox.netcredbrasil.com.br/graphql`  
> Environment: **sandbox**  
> Source: authenticated GraphQL `__schema` introspection

Machine-readable dump: [`netcred-graphql-introspection.json`](./netcred-graphql-introspection.json).

This file captures **what the API actually exposes**, including operations missing from the Postman collection.

## Counts

| Kind | Count |
|------|------:|
| Queries | 55 |
| Mutations | 171 |
| Types (ex `__*`) | 640 |

## Liquidation / payout (most relevant)

### Queries

- `advances` — args: `offset, before, after, first, last, created_Gte, created_Lte, previousTotalNetAmount_Gte, previousTotalNetAmount_Lte, totalNetAmount_Gte, totalNetAmount_Lte, id … (+8)`
- `movements` — args: `offset, before, after, first, last, created_Gte, created_Lte, settlingAt_Gte, settlingAt_Lte, settledAt_Gte, settledAt_Lte, movementStatus … (+50)`
- `negativeBalances` — args: `offset, before, after, first, last, id, id_In, orderBy, startDate_Gte, startDate_Lte, endDate_Gte, endDate_Lte … (+7)`
- `payoutCredentials` — args: `offset, before, after, first, last, id, id_In, orderBy, companyId, companyId_In, gateway, gateway_In … (+2)`
- `payoutEvents` — args: `offset, before, after, first, last, id, entityId, status, occurredAt, eventName, companyId, userCreateId … (+9)`
- `payoutFiles` — args: `offset, before, after, first, last, id, id_In, orderBy, companyId_In, status_In, detailedStatus_In, errors_Icontains … (+19)`
- `payoutRules` — args: `offset, before, after, first, last, id, id_In, orderBy, name, companyId, isPrimary, isActive … (+1)`
- `payouts` — args: `offset, before, after, first, last, settlingAt_Gte, settlingAt_Lte, settledAt_Gte, settledAt_Lte, id, id_In, orderBy … (+38)`
- `schedules` — args: `offset, before, after, first, last, id, id_In, orderBy, companyId`

### Recommended path for the Liquidations report UI

Use **`movements(transactionId: …)`** — same rows as the NetCred portal report (`id`, `amount`, `netAmount`, `settlingAt`, `settledAt`, `fees`).

```graphql
query MovementsByTransaction($transactionId: String!) {
  movements(first: 50, transactionId: $transactionId, orderBy: "id") {
    totalCount
    edges {
      node {
        id
        amount
        netAmount
        movementStatus
        movementType
        installment
        settlingAt
        settledAt
        isAdvance
        fees { edges { node { amount feeType description } } }
        payout { id payoutStatus settlingAt settledAt amount paidAmount }
        bankAccount { id holderName }
        holderCompany { id name }
      }
    }
  }
}
```

| Portal column | API field |
|---------------|-----------|
| ID | `MovementType.id` |
| Data Prevista Liqui. | `settlingAt` |
| Data Efetiva Liqui. | `settledAt` |
| Valor da Transação | `amount` |
| Valor Líquido | `netAmount` |
| Status | `movementStatus` |

`payouts` lists bank settlement batches (`settlingAt` / `settledAt` / `payoutStatus`) but **has no `transactionId` filter**. Link transaction → settlement via `movements` → `payout`.

### Key object fields

#### `PayoutType`

- `created: DateTime!`
- `modified: DateTime!`
- `id: ID!`
- `amount: Decimal!`
- `paidAmount: Decimal!`
- `brand: String`
- `acquirer: String`
- `payoutStatus: String!`
- `detailedStatus: String!`
- `settlingMethod: String!`
- `settlingAt: Date!`
- `approvedAt: DateTime`
- `settledAt: DateTime`
- `processedAt: DateTime`
- `bankAccount: BankAccountType`
- `payoutCredential: PayoutCredentialType`
- `payoutFileErrors: String`
- `payoutFilePaymentReturnFile: String`
- `company: CompanyType`
- `originalHolderCompany: CompanyType`
- `isContractEffectPayout: Boolean!`
- `isAdvance: Boolean!`
- `blocked: Boolean!`
- `blockReason: String`
- `gatewayReference: String`
- `slcSitSolictLiquidacao: String`
- `slcSitRespDomicilio: String`
- `slcCodOcorc: String`
- `movements: MovementTypeConnection!`
- `payoutFiles: PayoutFileTypeConnection!`
- `events: PayoutEventTypeConnection!`
- `hasUnappliedContractEffects: Boolean`
- `payoutBlockedByNegativeTotalAmount: Boolean`
- `companyBlocked: Boolean`
- `companyBlockReason: String`

#### `MovementType`

- `created: DateTime!`
- `modified: DateTime!`
- `userWrite: UserType`
- `id: ID!`
- `userCreate: UserType`
- `negativeBalance: NegativeBalanceType`
- `movementStatus: String!`
- `movementType: String!`
- `movementSource: String!`
- `recordType: String!`
- `baseSettleDate: Date`
- `settlingAt: Date!`
- `settledAt: DateTime`
- `installment: Int`
- `acquirer: String`
- `brand: String`
- `transaction: TransactionType`
- `periodicFee: PeriodicFeeType`
- `refund: RefundType`
- `dispute: DisputeType`
- `lease: LeaseType`
- `leasePeriod: LeasePeriodType`
- `advance: AdvanceType`
- `amount: Decimal!`
- `netAmount: Decimal!`
- `company: CompanyType`
- `holderCompany: CompanyType`
- `extraInfo: String`
- `payout: PayoutType`
- `holderDocument: String`
- `originalHolderDocument: String`
- `bankAccount: BankAccountType`
- `bankAccountHolderDocument: String!`
- `bankAccountHolderName: String`
- `bankAccountAgency: String`
- `bankAccountNumber: String!`
- `bankAccountAccountType: String!`
- `bankAccountBank: BankType`
- `payoutInfo: PayoutInfoType`
- `isAdvance: Boolean!`
- `timezone: PayoutMovementTimezoneChoices!`
- `advancesToApply: AdvanceTypeConnection!`
- `fees: FeeTypeConnection!`

#### `FeeType`

- `id: ID!`
- `amount: Decimal!`
- `feeType: String!`
- `description: String!`
- `movement: MovementType`
- `company: CompanyType`

#### `PayoutInfoType`

- `id: ID!`
- `transaction: TransactionType`
- `company: CompanyType`
- `splitType: String!`
- `proportion: Decimal`
- `amount: Decimal`
- `bankAccount: BankAccountType`
- `documentType: String!`
- `holderDocument: String!`
- `holderName: String`
- `agency: String!`
- `number: String!`
- `accountType: String!`
- `transferFee: Decimal!`
- `pixKeyType: String`
- `pixKey: String`
- `schedule: ScheduleType`
- `isLiable: Boolean!`
- `scheduleType: String`
- `scheduleAnchor: Int`
- `automaticAdvance: Boolean!`
- `movements: MovementTypeConnection!`

#### `PayoutRuleType`

- `created: DateTime!`
- `modified: DateTime!`
- `userCreate: UserType`
- `userWrite: UserType`
- `id: ID!`
- `company: CompanyType`
- `isActive: Boolean!`
- `isPrimary: Boolean!`
- `cardPayoutAllowed: Boolean!`
- `name: String`
- `extraInfo: String`
- `charges: ChargeTypeConnection!`
- `pixConfig: PixConfigTypeConnection!`
- `ruleItems: RuleItemTypeConnection!`
- `leases: LeaseTypeConnection!`
- `transactions: TransactionTypeConnection!`
- `chargeLinks: ChargeLinkTypeConnection!`

#### `ScheduleType`

- `created: DateTime!`
- `modified: DateTime!`
- `userCreate: UserType`
- `userWrite: UserType`
- `id: ID!`
- `scheduleType: String`
- `scheduleAnchor: Int`
- `automaticAdvance: Boolean!`
- `company: CompanyType`

#### `AdvanceType`

- `created: DateTime!`
- `modified: DateTime!`
- `userCreate: UserType`
- `userWrite: UserType`
- `id: ID!`
- `advanceStatus: String!`
- `advanceTo: Date!`
- `totalAmount: Decimal!`
- `previousTotalNetAmount: Decimal!`
- `totalNetAmount: Decimal!`
- `voidAt: DateTime`
- `voidReason: String`
- `rateType: String!`
- `rate: Decimal!`
- `targetMethod: String`
- `bankAccount: BankAccountType`
- `payoutRule: PayoutRuleType`
- `movementsToAdvance: MovementTypeConnection!`
- `company: CompanyType`
- `movements: MovementTypeConnection!`

#### `TransactionType`

- `created: DateTime!`
- `modified: DateTime!`
- `userCreate: UserType`
- `userWrite: UserType`
- `id: ID!`
- `acquirer: String`
- `paymentProfile: PaymentProfileType`
- `company: CompanyType`
- `customer: CustomerType`
- `charge: ChargeType`
- `lease: LeaseType`
- `billetCondition: BilletConditionType`
- `pixCondition: PixConditionType`
- `uuid: UUID!`
- `transactionState: String!`
- `method: String!`
- `installmentNumber: Int!`
- `amount: Decimal!`
- `refundedAmount: Decimal!`
- `paidAmount: Decimal!`
- `interestAmount: Decimal!`
- `fineAmount: Decimal!`
- `discountAmount: Decimal!`
- `captureMedium: String!`
- `billingAt: Date!`
- `billedAt: DateTime`
- `rejectedReason: String`
- `dueAt: Date!`
- `paidAt: DateTime`
- `voidAt: DateTime`
- `voidReason: String`
- `isDisputed: Boolean!`
- `authorizationCode: String`
- `manualCapture: Boolean!`
- `attempts: Int!`
- `billExpiryDate: Date`
- `refundMaxDate: Date`
- `printUrl: String`
- `gateway: String`
- `gatewayReference: String`
- `billingCycle: Int!`
- `acquirerCode: String`
- `acquirerMid: String`
- `contract: ContractType`
- `payoutRule: PayoutRuleType`
- `processedAt: DateTime`
- `feesTransferredToCustomer: Decimal!`
- `gatewayCredential: GatewayCredentialType`
- `riskAnalysisGatewayCredential: GatewayCredentialType`
- `movements: MovementTypeConnection!`
- `operations: OperationTypeConnection!`
- `billingInfo: BillingInfoType`
- `cardInfo: CardInfoType`
- `billetInfo: BilletInfoType`
- `pixInfo: PixInfoType`
- `payoutInfos: PayoutInfoTypeConnection!`
- `disputes: DisputeTypeConnection!`
- `refunds: RefundTypeConnection!`
- `events: TransactionEventTypeConnection!`
- `riskAnalysisStatus: String`
- `riskAnalysisScore: Decimal`
- `riskAnalysisSettledBy: UserType`
- `riskAnalysisSettledAt: DateTime`
- `riskAnalysisIsManuallyApproved: Boolean`
- `averageDelay: Float`
- `totalDelayCount: Int`
- `numberOfClientsDelay: Int`

#### `ChargeType`

- `created: DateTime!`
- `modified: DateTime!`
- `userCreate: UserType`
- `userWrite: UserType`
- `id: ID!`
- `uuid: UUID!`
- `referenceCode: String`
- `chargeType: String!`
- `subscription: Boolean!`
- `chargeStatus: String!`
- `company: CompanyType`
- `method: String`
- `submethod: String!`
- `customer: CustomerType`
- `paymentProfile: PaymentProfileType`
- `amount: Decimal!`
- `installmentNumber: Int`
- `billDaysInAdvance: Int`
- `chargeLink: ChargeLinkType`
- `billetCondition: BilletConditionType`
- `pixCondition: PixConditionType`
- `contract: ContractType`
- `payoutRule: PayoutRuleType`
- `extraInfo: String`
- `rrule: String`
- `customerIpAddress: String`
- `ipAddress: String`
- `voidAt: Date`
- `voidReason: String`
- `manualCapture: Boolean!`
- `billingCycleTotal: Int`
- `billingCyclesPaid: Int!`
- `billingCyclesProcessed: Int!`
- `serviceCode: String`
- `transactions: TransactionTypeConnection!`
- `order: OrderType`
- `events: ChargeEventTypeConnection!`
- `chargeTotalAmount: Decimal`
- `lastPaymentDate: DateTime`

## All queries

### Payout / movements / advances

- `advances`
- `movements`
- `negativeBalances`
- `payoutCredentials`
- `payoutEvents`
- `payoutFiles`
- `payoutRules`
- `payouts`
- `schedules`

### Charges / transactions / refunds

- `billetConditions`
- `chargeEvents`
- `chargeLink`
- `chargeLinkEvents`
- `chargeLinks`
- `charges`
- `disputeEvents`
- `disputes`
- `operations`
- `paymentProfileEvents`
- `paymentProfiles`
- `pixConditions`
- `refunds`
- `transactionEvents`
- `transactions`
- `transactionsDashboard`

### Company / onboarding / bank

- `bankAccounts`
- `banks`
- `cnaes`
- `companies`
- `companyAcquirers`
- `companyEvents`
- `companyLiaisons`
- `contracts`
- `gatewayCredentials`
- `registrationProcesses`
- `registrationStatusDetails`
- `representatives`
- `whiteLabelConfigs`

### Notifications / webhooks / events

- `apiNotifications`
- `chargeEvents`
- `chargeLinkEvents`
- `companyEvents`
- `disputeEvents`
- `notificationAttachments`
- `notificationEventTriggers`
- `notificationRecipients`
- `notificationRecords`
- `notificationRules`
- `notifications`
- `paymentProfileEvents`
- `payoutEvents`
- `transactionEvents`
- `userEvents`
- `webhooks`

### Other

- `customers`
- `frameworks`
- `leases`
- `me`
- `models`
- `providers`
- `terminals`
- `users`

## All mutations

Grouped by name prefix (full descriptions in JSON).

### `admin*`

- `adminDisableTwoFactorAuth`

### `advance*`

- `advanceApply`
- `advanceCreate`
- `advanceRateSimpleInterestSimulate`
- `advanceSimulate`
- `advanceVoid`

### `available*`

- `availableNotificationAttachmentFiles`
- `availableNotificationHtmlFiles`
- `availableNotificationImageFiles`
- `availablePermissionsList`

### `bankAccount*`

- `bankAccountCreate`
- `bankAccountDelete`
- `bankAccountReplace`
- `bankAccountUpdate`

### `billet*`

- `billetConditionCreate`
- `billetConditionDelete`
- `billetConditionUpdate`
- `billetConfigUpdate`

### `bulk*`

- `bulkFeeUpdate`
- `bulkTransactionsContractLink`
- `bulkTransactionsVoid`

### `card*`

- `cardOnlineConfigUpdate`
- `cardTerminalConfigUpdate`

### `charge*`

- `chargeCreate`
- `chargeLinkCreate`
- `chargeLinkDelete`
- `chargeLinkPay`
- `chargeLinkSend`
- `chargeLinkUpdate`
- `chargeSimulate`
- `chargeUpdate`
- `chargeVoid`

### `city*`

- `cityCreate`
- `cityUpdate`

### `company*`

- `companyCreate`
- `companyDataUpdate`
- `companyLiaisonCreate`
- `companyLiaisonDelete`
- `companyLiaisonUpdate`
- `companyUpdate`

### `contract*`

- `contractCreate`
- `contractRuleUpdate`
- `contractUpdate`

### `customer*`

- `customerAddressCreate`
- `customerAddressDelete`
- `customerAddressUpdate`
- `customerCreate`
- `customerDelete`
- `customerUpdate`

### `dimp*`

- `dimpFilesPeriodCreate`

### `dispute*`

- `disputeCreate`
- `disputeEventCreate`
- `disputeEventDelete`
- `disputeEventUpdate`
- `disputeUpdate`

### `event*`

- `eventContextFormat`

### `external*`

- `externalCompanyAssociationCreate`
- `externalCompanyAssociationDelete`
- `externalCompanyAssociationUpdate`

### `framework*`

- `frameworkCreate`
- `frameworkUpdate`

### `gateway*`

- `gatewayCredentialCreate`

### `lease*`

- `leaseCreate`
- `leaseUpdate`

### `manual*`

- `manualPayoutFileSend`
- `manualPayoutFileUpdate`

### `model*`

- `modelCreate`
- `modelUpdate`

### `movement*`

- `movementCreate`

### `negative*`

- `negativeBalanceUpdate`

### `notification*`

- `notificationAttachmentCreate`
- `notificationAttachmentDelete`
- `notificationAttachmentUpdate`
- `notificationConfigUpdate`
- `notificationCreate`
- `notificationDuplicate`
- `notificationEventTriggerCreate`
- `notificationEventTriggerDelete`
- `notificationEventTriggerUpdate`
- `notificationRecipientCreate`
- `notificationRecipientDelete`
- `notificationRecipientUpdate`
- `notificationRuleCreate`
- `notificationRuleDelete`
- `notificationRuleUpdate`
- `notificationSend`
- `notificationUpdate`

### `order*`

- `orderCreate`
- `orderUpdate`

### `paymentProfile*`

- `paymentProfileCreate`
- `paymentProfileReplace`
- `paymentProfileUpdate`
- `paymentProfileVoid`

### `payout*`

- `payoutApprove`
- `payoutBlock`
- `payoutCredentialCreate`
- `payoutFileCheck`
- `payoutRuleCreate`
- `payoutRuleDelete`
- `payoutRuleReplace`
- `payoutRuleUpdate`
- `payoutSettle`

### `pix*`

- `pixConditionCreate`
- `pixConditionDelete`
- `pixConditionUpdate`
- `pixConfigUpdate`

### `provider*`

- `providerCreate`
- `providerUpdate`

### `referral*`

- `referralConfigUpdate`

### `refresh*`

- `refreshToken`

### `registration*`

- `registrationCollectingDocumentsComplete`
- `registrationContractSendingComplete`
- `registrationContractSigningComplete`
- `registrationContractSigningFail`
- `registrationDocumentsValidationComplete`
- `registrationDocumentsValidationFail`
- `registrationFinalStepComplete`
- `registrationPartnerAssociationComplete`
- `registrationProcessCancel`
- `registrationProcessCreate`
- `registrationProcessUpdate`
- `registrationStatusDetailsCreate`
- `registrationStatusDetailsDelete`
- `registrationStatusDetailsUpdate`

### `representative*`

- `representativeCreate`
- `representativeDelete`
- `representativeUpdate`

### `resend*`

- `resendEfinanceiraEvents`

### `reset*`

- `resetDefaultNotifications`

### `risk*`

- `riskAnalysisConfigUpdate`
- `riskAnalysisSettle`

### `schedule*`

- `scheduleCreate`
- `scheduleDelete`
- `scheduleUpdate`

### `send*`

- `sendEfinanceiraDeclarante`

### `services*`

- `servicesConfigUpdate`

### `state*`

- `stateCreate`
- `stateUpdate`

### `terminal*`

- `terminalCreate`
- `terminalDelete`
- `terminalUpdate`

### `token*`

- `tokenAuth`

### `transaction*`

- `transactionBill`
- `transactionCapture`
- `transactionNegativeListing`
- `transactionProtest`
- `transactionRefund`
- `transactionRetry`
- `transactionSimulatePayment`
- `transactionUpdate`
- `transactionVoid`

### `user*`

- `userChangePermissions`
- `userCreate`
- `userDelete`
- `userDisableTwoFactorAuth`
- `userEnableTwoFactorAuth`
- `userProfileUpdate`
- `userReactivate`
- `userResend`
- `userTwoFactorGetUri`
- `userUnblock`
- `userUpdate`
- `userUpdatePassword`

### `verify*`

- `verifyToken`

### `webhook*`

- `webhookCreate`
- `webhookDelete`
- `webhookPing`
- `webhookUpdate`

### `whitelabel*`

- `whitelabelConfigCreate`
- `whitelabelConfigDelete`
- `whitelabelConfigUpdate`

## Notes

- Postman collection **API Netcred** documents only a subset (mainly charge/tokenize/refund + `payoutRules` / `bankAccounts`).
- Introspection revealed undocumented (in Postman) but live queries such as `payouts`, `movements`, `advances`, `payoutEvents`, `schedules`.
- Fee breakdown on movements uses nested `fees` with `feeType` values observed in sandbox: `MDR`, `PROCESSING`, `RISK_ANALYSIS`.
- Re-run this dump when NetCred changes the schema; keep JSON + this markdown in sync.

