import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProviderJobDetail } from "../hooks/useProviderJobDetail";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { JobDetailContent, JobDetailNotFound } from "./JobDetailPage";

interface JobDetailSheetProps {
  jobId: string;
  initialJob: ProviderJobItem | null;
}

export function JobDetailSheet({ jobId, initialJob }: JobDetailSheetProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const { job, isLoading } = useProviderJobDetail(jobId, { initialJob });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      navigate(-1);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
          <SheetTitle>Detalhes do trabalho</SheetTitle>
          <SheetClose asChild>
            <button
              type="button"
              className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-background opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-6"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </button>
          </SheetClose>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div
              className="flex justify-center py-12"
              aria-busy="true"
              aria-label="Carregando detalhes do trabalho"
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && job && <JobDetailContent job={job} />}
          {!isLoading && !job && <JobDetailNotFound />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
