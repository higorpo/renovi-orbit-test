import type { Location } from "react-router";

export type ServiceDetailReturnTo =
  | "/dashboard/jobs"
  | "/dashboard/services";

export interface ServiceDetailLocationState {
  serviceDetailPresentation?: "sheet";
  returnTo?: ServiceDetailReturnTo;
  /** Route to keep rendered behind the sheet (modal routing). */
  background?: Location;
}

export function createProviderJobsServiceDetailState(
  background: Location,
): ServiceDetailLocationState {
  return {
    serviceDetailPresentation: "sheet",
    returnTo: "/dashboard/jobs",
    background,
  };
}

export function createProviderMyServicesServiceDetailState(
  background: Location,
): ServiceDetailLocationState {
  return {
    serviceDetailPresentation: "sheet",
    returnTo: "/dashboard/services",
    background,
  };
}
