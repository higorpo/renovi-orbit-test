export const CHARGE_CREATE_MUTATION = `
mutation chargeCreateCardWithSplit($input: ChargeCreateInput!) {
  chargeCreate(input: $input) {
    errors { field message code }
    charge {
      id
      amount
      referenceCode
      chargeStatus
      transactions {
        edges {
          node {
            id
            transactionState
            amount
            paidAmount
            paidAt
            rejectedReason
          }
        }
      }
    }
  }
}
`;

export const PAYMENT_PROFILE_CREATE_MUTATION = `
mutation paymentProfileCreateCard($input: PaymentProfileCreateInput!) {
  paymentProfileCreate(input: $input) {
    errors { field message code }
    paymentProfile {
      id
      method
      isActive
      cardNumber
      expiryMonth
      expiryYear
      brand
      cardHolderName
      token
      rejectedReason
      customer { id name documentType document }
    }
  }
}
`;

export const TRANSACTION_REFUND_MUTATION = `
mutation transactionRefund($input: TransactionRefundInput!) {
  transactionRefund(input: $input) {
    errors { field message code }
    transaction {
      id
      amount
      paidAmount
      refundedAmount
      transactionState
    }
  }
}
`;

export const CHARGE_VOID_MUTATION = `
mutation chargeVoid($input: ChargeVoidInput!) {
  chargeVoid(input: $input) {
    errors { field message code }
    charge {
      id
      chargeStatus
    }
  }
}
`;

export const COMPANIES_BY_DOCUMENT_QUERY = `
query companiesByDocument($document: String!) {
  companies(document: $document) {
    edges {
      node {
        id
        name
        legalName
        documentType
        document
        companyType
        companyState
        bankAccounts {
          edges {
            node {
              id
              holderDocument
              isActive
            }
          }
        }
      }
    }
  }
}
`;

export const TRANSACTIONS_BY_REFERENCE_QUERY = `
query transactionsByReference(
  $companyId: Int!
  $referenceCode: String!
  $first: Int!
) {
  transactions(
    companyId: $companyId
    referenceCode: $referenceCode
    first: $first
  ) {
    edges {
      node {
        id
        transactionState
        amount
        paidAmount
        paidAt
        rejectedReason
        charge {
          id
          referenceCode
        }
      }
    }
  }
}
`;
