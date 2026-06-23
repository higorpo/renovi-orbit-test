import { SERVICE_DETAIL_PAGE_MAX_WIDTH_CLASS } from "@/features/view-services/constants/serviceDetail.constants";
import { cn } from "@/lib/utils";
import { useProviderCalendarPage } from "../hooks/useProviderCalendarPage";
import { ProviderCalendarErrorState } from "./ProviderCalendarErrorState";
import { ProviderCalendarGridView } from "./ProviderCalendarGridView";
import { ProviderCalendarHeader } from "./ProviderCalendarHeader";
import { ProviderCalendarListView } from "./ProviderCalendarListView";
import { ProviderCalendarSkeleton } from "./ProviderCalendarSkeleton";

export function ProviderCalendarPage() {
  const {
    viewMode,
    list,
    month,
    handleOpenService,
    isLoading,
    isError,
    refetch,
  } = useProviderCalendarPage();

  return (
    <div className={cn("mx-auto w-full min-w-0 px-4 py-6", SERVICE_DETAIL_PAGE_MAX_WIDTH_CLASS)}>
      <ProviderCalendarHeader />

      <section className="mt-0 md:mt-6" aria-label="Agenda de serviços">
        {isLoading ? <ProviderCalendarSkeleton viewMode={viewMode} /> : null}
        {!isLoading && isError ? (
          <ProviderCalendarErrorState onRetry={() => void refetch()} />
        ) : null}
        {!isLoading && !isError && viewMode === "list" ? (
          <ProviderCalendarListView list={list} onOpenService={handleOpenService} />
        ) : null}
        {!isLoading && !isError && viewMode === "grid" ? (
          <ProviderCalendarGridView month={month} onOpenService={handleOpenService} />
        ) : null}
      </section>
    </div>
  );
}
