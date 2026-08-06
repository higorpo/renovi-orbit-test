import {
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Clock,
  CreditCard,
  FilePenLine,
  Flame,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  MessageSquareQuote,
  Star,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProviderCardHighlightIcon,
  ProviderCardInfoIcon,
} from "../../utils/providerServiceCardPresentation";

const HIGHLIGHT_ICONS: Record<ProviderCardHighlightIcon, LucideIcon> = {
  new_message: Mail,
  revision: FilePenLine,
  waiting: Clock,
  conversation: MessageSquare,
  scheduled: CalendarDays,
  today: Flame,
  payment_pending: CreditCard,
  completed: CircleCheck,
  cancelled: CircleX,
};

const INFO_ICONS: Record<ProviderCardInfoIcon, LucideIcon> = {
  location: MapPin,
  amount: CircleDollarSign,
  date: CalendarDays,
  info: Info,
  rating: Star,
  quote: MessageSquareQuote,
  tag: Tag,
};

export function ProviderCardHighlightIcon({
  icon,
  iconBoxClassName,
  iconClassName,
}: {
  icon: ProviderCardHighlightIcon;
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

export function ProviderCardInfoIcon({
  icon,
  className,
}: {
  icon: ProviderCardInfoIcon;
  className?: string;
}) {
  const Icon = INFO_ICONS[icon];

  return (
    <Icon
      className={cn(
        "h-3.5 w-3.5 shrink-0",
        icon === "rating" && "fill-amber-400 text-amber-500",
        className,
      )}
      strokeWidth={icon === "rating" ? 1.5 : 2}
      aria-hidden
    />
  );
}
