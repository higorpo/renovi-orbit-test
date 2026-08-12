import type { Location } from "react-router";

export type ServiceDetailReturnTo =
  | "/dashboard/jobs"
  | "/dashboard/services"
  | "/dashboard/services/calendar"
  | "/dashboard/settings/earnings";

export type MyServicesViewerRole = "client" | "provider";

export interface ServiceDetailLocationState {
  serviceDetailPresentation?: "sheet";
  returnTo?: ServiceDetailReturnTo;
  myServicesRole?: MyServicesViewerRole;
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
    myServicesRole: "provider",
    background,
  };
}

export function createProviderEarningsServiceDetailState(
  background: Location,
): ServiceDetailLocationState {
  return {
    serviceDetailPresentation: "sheet",
    returnTo: "/dashboard/settings/earnings",
    myServicesRole: "provider",
    background,
  };
}

export function createProviderCalendarServiceDetailState(
  background: Location,
): ServiceDetailLocationState {
  return {
    returnTo: "/dashboard/services/calendar",
    myServicesRole: "provider",
    background,
  };
}

export function createClientMyServicesServiceDetailState(
  background: Location,
): ServiceDetailLocationState {
  return {
    serviceDetailPresentation: "sheet",
    returnTo: "/dashboard/services",
    myServicesRole: "client",
    background,
  };
}
