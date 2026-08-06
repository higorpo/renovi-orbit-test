import {
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  FileText,
  Flame,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceRequestBudgetActionIcon } from "@/features/view-services";
import type {
  ClientCardHighlightIcon,
  ClientCardInfoIcon,
} from "../../utils/clientServiceCardPresentation";

const HIGHLIGHT_ICONS: Record<ClientCardHighlightIcon, LucideIcon> = {
  new_message: Mail,
  proposals: FileText,
  waiting: Clock,
  conversation: MessageSquare,
  scheduled: CalendarDays,
  today: Flame,
  payment_pending: CreditCard,
  completed: CircleCheck,
  cancelled: CircleX,
};

const INFO_ICONS: Record<ClientCardInfoIcon, LucideIcon> = {
  location: MapPin,
  amount: Tag,
  date: CalendarDays,
  provider: UserRound,
  info: Info,
  tag: Tag,
  chat: MessageSquare,
};

export function ClientCardHighlightIcon({
  icon,
  iconBoxClassName,
  iconClassName,
}: {
  icon: ClientCardHighlightIcon;
  iconBoxClassName: string;
  iconClassName: string;
}) {
  const Icon = HIGHLIGHT_ICONS[icon];

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        iconBoxClassName,
      )}
      aria-hidden
    >
      <Icon className={cn("h-4 w-4", iconClassName)} strokeWidth={2} />
    </span>
  );
}

export function ClientCardInfoIcon({
  icon,
  className,
}: {
  icon: ClientCardInfoIcon;
  className?: string;
}) {
  const Icon = INFO_ICONS[icon];

  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} strokeWidth={2} aria-hidden />;
}

export function clientBudgetActionIcon(isNegotiation: boolean) {
  return getServiceRequestBudgetActionIcon(isNegotiation ? "negotiation" : "completed");
}
