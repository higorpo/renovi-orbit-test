import { CircleHelp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SUGGESTED_ITEMS_TOOLTIP_TEXT } from "../constants/serviceDetail.constants";

export function SuggestedItemsInfo({ ariaLabel }: { ariaLabel: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={ariaLabel}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-xs leading-relaxed" align="start">
        {SUGGESTED_ITEMS_TOOLTIP_TEXT}
      </PopoverContent>
    </Popover>
  );
}
