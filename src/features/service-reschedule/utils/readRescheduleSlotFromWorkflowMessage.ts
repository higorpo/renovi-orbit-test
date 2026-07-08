import type { ChatMessageListItem } from "@/features/chats";
import type { ServiceRescheduleSlot } from "../types/serviceReschedule.types";

export function readRescheduleSlotFromWorkflowMessage(
  message: Pick<ChatMessageListItem, "payload">,
): ServiceRescheduleSlot | null {
  const slot = message.payload?.slot;
  if (!slot || typeof slot !== "object") return null;

  const record = slot as Record<string, unknown>;
  const startDate = record.start_date;
  const shift = record.shift;
  if (
    typeof startDate !== "string" ||
    (shift !== "morning" && shift !== "afternoon" && shift !== "full_day")
  ) {
    return null;
  }

  return {
    start_date: startDate,
    end_date: typeof record.end_date === "string" ? record.end_date : null,
    shift,
  };
}
