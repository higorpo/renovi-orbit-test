const NAV_ITEM_GAP_PX = 6;

export { NAV_ITEM_GAP_PX };

export interface ComputeDesktopNavVisibleCountParams {
  containerWidth: number;
  itemWidths: number[];
  moreButtonWidth: number;
  gapPx?: number;
}

/** Max prefix of items that fit in the nav row, reserving space for a "more" trigger when truncated. */
export function computeDesktopNavVisibleCount({
  containerWidth,
  itemWidths,
  moreButtonWidth,
  gapPx = NAV_ITEM_GAP_PX,
}: ComputeDesktopNavVisibleCountParams): number {
  const count = itemWidths.length;
  if (count === 0 || containerWidth <= 0) return count;

  const rowWidth = (visibleCount: number, withMore: boolean) => {
    if (visibleCount <= 0) return 0;
    const sum = itemWidths.slice(0, visibleCount).reduce((acc, w) => acc + w, 0);
    const gaps = gapPx * Math.max(0, visibleCount - 1);
    const more = withMore && visibleCount < count ? moreButtonWidth + gapPx : 0;
    return sum + gaps + more;
  };

  if (rowWidth(count, false) <= containerWidth) return count;

  let lo = 1;
  let hi = count;
  let best = 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (rowWidth(mid, mid < count) <= containerWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return Math.max(1, best);
}
