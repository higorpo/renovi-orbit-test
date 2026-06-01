import { getPlatformConstantInt } from "@/lib/platformConstants";

export const PROPOSAL_RESPONSE_SLA_KEY = "chats.proposal_response_sla_hours" as const;
export const DEFAULT_PROPOSAL_RESPONSE_SLA_HOURS = 24;

export async function getProposalResponseSlaHours(): Promise<number> {
  return getPlatformConstantInt(PROPOSAL_RESPONSE_SLA_KEY, DEFAULT_PROPOSAL_RESPONSE_SLA_HOURS);
}
