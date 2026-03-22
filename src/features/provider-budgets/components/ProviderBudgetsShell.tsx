import { Fragment } from "react";
import { Outlet, useLocation, useMatch } from "react-router";
import { JobDetailPage } from "@/features/provider-jobs/components/JobDetailPage";
import { JobDetailSheet } from "@/features/provider-jobs/components/JobDetailSheet";
import type { JobDetailLocationState } from "@/features/provider-jobs/types/provider-jobs.types";
import { ProviderBudgetsPage } from "./ProviderBudgetsPage";

export function ProviderBudgetsRouteSlot() {
  return null;
}

export function ProviderBudgetsShell() {
  const location = useLocation();
  const match = useMatch("/dashboard/budgets/pedido/:serviceRequestId");
  const serviceRequestId = match?.params.serviceRequestId;
  const state = location.state as JobDetailLocationState | null;
  const openAsSheet =
    Boolean(serviceRequestId) && state?.jobDetailPresentation === "sheet";
  const openAsFullPage = Boolean(serviceRequestId) && !openAsSheet;

  return (
    <Fragment>
      {(!serviceRequestId || openAsSheet) && <ProviderBudgetsPage />}
      {openAsSheet && serviceRequestId && (
        <JobDetailSheet jobId={serviceRequestId} initialJob={state?.job ?? null} />
      )}
      {openAsFullPage && serviceRequestId && (
        <JobDetailPage jobId={serviceRequestId} />
      )}
      <Outlet />
    </Fragment>
  );
}
