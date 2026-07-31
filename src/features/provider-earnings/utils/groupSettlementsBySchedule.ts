import type { SettlementMovement, SettlementScheduleGroup } from "../types/settlements.types";

/** Groups consecutive movements that share the same paymentScheduleId. */
export function groupSettlementsBySchedule(
  items: SettlementMovement[],
): SettlementScheduleGroup[] {
  const groups: SettlementScheduleGroup[] = [];

  for (const item of items) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.paymentScheduleId != null &&
      item.paymentScheduleId != null &&
      last.paymentScheduleId === item.paymentScheduleId
    ) {
      last.items.push(item);
      continue;
    }

    groups.push({
      paymentScheduleId: item.paymentScheduleId,
      items: [item],
    });
  }

  return groups;
}
