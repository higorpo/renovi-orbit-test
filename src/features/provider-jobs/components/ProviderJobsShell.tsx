import { Fragment } from "react";
import { Outlet, useLocation, useMatch } from "react-router";
import type { JobDetailLocationState } from "../types/provider-jobs.types";
import { JobDetailPage } from "./JobDetailPage";
import { JobDetailSheet } from "./JobDetailSheet";
import { ProviderJobsPage } from "./ProviderJobsPage";

/** Renders nothing; exists so React Router matches `/dashboard/jobs` and `/dashboard/jobs/:jobId`. */
export function ProviderJobsRouteSlot() {
  return null;
}

export function ProviderJobsShell() {
  const location = useLocation();
  const match = useMatch("/dashboard/jobs/:jobId");
  const jobId = match?.params.jobId;
  const state = location.state as JobDetailLocationState | null;
  const openAsSheet = Boolean(jobId) && state?.jobDetailPresentation === "sheet";
  const openAsFullPage = Boolean(jobId) && !openAsSheet;

  return (
    <Fragment>
      {(!jobId || openAsSheet) && <ProviderJobsPage />}
      {openAsSheet && jobId && (
        <JobDetailSheet jobId={jobId} initialJob={state?.job ?? null} />
      )}
      {openAsFullPage && jobId && <JobDetailPage jobId={jobId} />}
      <Outlet />
    </Fragment>
  );
}
