import { Clock, MapPin, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { formatServiceRequestDate } from "../utils/formatDate";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";
import { ServiceRequestSections } from "./ServiceRequestSections";
import type { FormSchema } from "@/features/dynamic-form";

interface OpenServiceDetailsSheetProps {
  open: boolean;
  serviceRequest: ServiceRequestCardModel | null;
  onOpenChange: (open: boolean) => void;
}

function formatFullAddress(model: ServiceRequestCardModel): string {
  const address = model.address;
  if (!address) return "Endereço não informado";

  const line1 = [address.street, address.number].filter(Boolean).join(", ");
  const line2Parts = [address.neighborhood, address.cityName]
    .map((part) => part?.trim())
    .filter(Boolean);
  const line2 = line2Parts.join(", ");
  const state = address.stateAbbreviation?.trim();
  const zip = address.zipCode?.trim();
  const complement = address.complement?.trim();

  const parts = [
    line1 || null,
    complement ? `Complemento: ${complement}` : null,
    line2 ? (state ? `${line2} - ${state}` : line2) : state ?? null,
    zip ? `CEP: ${zip}` : null,
  ].filter(Boolean);

  return parts.join(" | ");
}

export function OpenServiceDetailsSheet({
  open,
  serviceRequest,
  onOpenChange,
}: OpenServiceDetailsSheetProps) {
  const serviceStyle = getServiceCardStyle(serviceRequest?.service ?? undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
          <SheetTitle>Detalhes do pedido de orçamento</SheetTitle>
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
          {!serviceRequest ? null : (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  {serviceRequest.service && (
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        serviceStyle.color
                      )}
                      aria-hidden
                    >
                      <serviceStyle.Icon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {serviceRequest.service?.title ?? "Serviço"}
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold leading-tight sm:text-2xl">
                      {serviceRequest.title}
                    </h1>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{formatFullAddress(serviceRequest)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Criado em {formatServiceRequestDate(serviceRequest.createdAt)}</span>
                  </span>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="pt-4">
                <ServiceRequestSections
                  description={serviceRequest.description}
                  formData={serviceRequest.formData}
                  formSchema={serviceRequest.formSchema as FormSchema | null}
                  photos={serviceRequest.photoPaths}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
