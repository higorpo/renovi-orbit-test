/**
 * React Query key roots for provider-jobs. Use partial keys with invalidateQueries
 * (e.g. ["provider-proposal-job-detail", jobId]) to refresh all variants.
 */
export const PROVIDER_JOBS_LIST_QUERY_KEY = "provider-jobs" as const;

export const PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY =
  "provider-proposal-job-detail" as const;

export const PROVIDER_JOB_QUESTIONS_QUERY_KEY = "provider-job-questions" as const;

export const PROVIDER_PROPOSALS_HISTORY_QUERY_KEY =
  "provider-proposals-history" as const;
