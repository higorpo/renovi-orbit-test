import { useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SERVICE_DETAIL_SHEET_WIDTH_CLASS } from "../constants/serviceDetail.constants";
import { ServiceDetailPage } from "./ServiceDetailPage";
import { cn } from "@/lib/utils";

interface ServiceDetailSheetProps {
  serviceRequestId: string;
}

export function ServiceDetailSheet({ serviceRequestId }: ServiceDetailSheetProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

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
        className={cn(
          "flex flex-col gap-0 border-l p-0",
          SERVICE_DETAIL_SHEET_WIDTH_CLASS,
        )}
      >
        <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
          <SheetTitle>Detalhes do serviço</SheetTitle>
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <ServiceDetailPage serviceRequestId={serviceRequestId} isInsideSheet />
        </div>
      </SheetContent>
    </Sheet>
  );
}
