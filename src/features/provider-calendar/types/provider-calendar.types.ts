export type ScheduledShift = "morning" | "afternoon" | "full_day";

export interface ScheduledServiceItem {
  serviceRequestId: string;
  contractedServiceId: string;
  title: string;
  platformServiceTitle: string | null;
  platformServiceColorKey: string | null;
  scheduledStartDate: string;
  scheduledEndDate: string;
  scheduledShift: ScheduledShift;
  status: string;
}

export interface ScheduledServicesRangeResult {
  items: ScheduledServiceItem[];
  rangeFrom: string;
  rangeTo: string;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export type CalendarViewMode = "list" | "grid";

export interface CalendarDayEntry {
  date: string;
  services: ScheduledServiceDayItem[];
}

export interface ScheduledServiceDayItem {
  service: ScheduledServiceItem;
  spanPosition: "single" | "start" | "middle" | "end";
}

export interface WeekEventBar {
  service: ScheduledServiceItem;
  startCol: number;
  span: number;
  lane: number;
  continuesFromPreviousWeek: boolean;
  continuesIntoNextWeek: boolean;
}
