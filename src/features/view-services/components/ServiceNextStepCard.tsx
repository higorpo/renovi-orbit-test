import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ServiceNextStep, ServiceNextStepIcon } from "../utils/serviceNextStep";
import { SERVICE_DETAIL_SURFACE_RADIUS_CLASS } from "../constants/serviceDetail.constants";

export interface ServiceNextStepCardProps {
  step: ServiceNextStep;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
}

const ICON_MAP: Record<ServiceNextStepIcon, LucideIcon> = {
  credit_card: CreditCard,
  star: Star,
  file_text: FileText,
  message: MessageSquare,
  check_circle: CheckCircle2,
  map_pin: MapPin,
  pencil: Pencil,
  eye: Eye,
};

export function ServiceNextStepCard({
  step,
  onAction,
  disabled = false,
  className,
}: ServiceNextStepCardProps) {
  const Icon = ICON_MAP[step.icon];
  const TrustIcon = step.trustFooter?.icon === "lock" ? Lock : ShieldCheck;
  const isDisabled = disabled || Boolean(step.disabled);

  const actionButton = (
    <Button
      type="button"
      size="lg"
      disabled={isDisabled}
      onClick={onAction}
      className={cn(
        "h-12 w-full gap-2 rounded-full bg-white font-semibold text-primary shadow-md",
        "hover:bg-white/90 active:scale-[0.98]",
        "transition-transform duration-fast ease-renovi",
        "disabled:bg-white/70 disabled:text-primary/60",
      )}
      data-testid="service-next-step-cta"
    >
      <span className="truncate">{step.actionLabel}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Button>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        SERVICE_DETAIL_SURFACE_RADIUS_CLASS,
        "bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-elevation-1 sm:p-6",
        className,
      )}
      aria-label={`${step.eyebrow}: ${step.title}`}
      data-testid="service-next-step-card"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/75">
            {step.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug tracking-tight sm:text-xl">
            {step.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-primary-foreground/85">
            {step.description}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isDisabled && step.disabledReason ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex w-full">{actionButton}</span>
              </TooltipTrigger>
              <TooltipContent>{step.disabledReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          actionButton
        )}
      </div>

      {step.trustFooter ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary-foreground/75">
          <TrustIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{step.trustFooter.text}</span>
        </p>
      ) : null}
    </motion.section>
  );
}
