import { cn } from "@/lib/utils";

export function getChatMessageBubbleClassName(options: {
  isOutgoing: boolean;
  isPending?: boolean;
}): string {
  return cn(
    "max-w-[82%] rounded-2xl shadow-sm",
    options.isOutgoing
      ? "rounded-br-md bg-primary text-primary-foreground"
      : "rounded-bl-md bg-muted text-foreground",
    options.isPending && "opacity-70",
  );
}
