/**
 * CNS proposal RPC names — single source for proposals.api.ts (task 87).
 * All mutations go through supabase.rpc; no direct table writes from the client.
 */
export const CNS_PROPOSAL_RPC = {
  submitProposal: "submit_proposal",
  acceptProposal: "accept_proposal",
  rejectProposal: "reject_proposal",
  requestRevision: "request_proposal_revision",
  declineRevision: "decline_revision_request",
  listProposalVersions: "list_proposal_versions",
  /** Legacy path — delegates to submit_proposal after Wave D cutover (task 97). */
  createProviderProposal: "create_provider_proposal",
} as const;

export type CnsProposalRpcName = (typeof CNS_PROPOSAL_RPC)[keyof typeof CNS_PROPOSAL_RPC];
