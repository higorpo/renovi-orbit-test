/** Production builds fail closed when ClearSale SDK cannot initialize (CHK-011). */
export function isClearSaleProductionFailClosed(): boolean {
  return import.meta.env.PROD === true;
}
