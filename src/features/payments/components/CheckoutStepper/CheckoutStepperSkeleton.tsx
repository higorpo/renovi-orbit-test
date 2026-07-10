import { Skeleton } from "@/components/ui/skeleton";

export function CheckoutStepperSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Carregando checkout"
      data-testid="checkout-stepper-skeleton"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  );
}
