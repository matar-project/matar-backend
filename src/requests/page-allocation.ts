export interface PageRange {
  startPage: number;
  endPage: number;
}

export function getNextAvailableRange(
  totalPages: number,
  reservations: PageRange[],
): PageRange | null {
  return getAvailableRanges(totalPages, reservations)[0] ?? null;
}

export function getAvailableRanges(
  totalPages: number,
  reservations: PageRange[],
): PageRange[] {
  const availableRanges: PageRange[] = [];
  let nextPage = 1;
  for (const reservation of [...reservations].sort(
    (first, second) => first.startPage - second.startPage,
  )) {
    if (reservation.endPage < nextPage) continue;
    if (reservation.startPage > nextPage) {
      availableRanges.push({
        startPage: nextPage,
        endPage: Math.min(totalPages, reservation.startPage - 1),
      });
    }
    nextPage = Math.max(nextPage, reservation.endPage + 1);
    if (nextPage > totalPages) return availableRanges;
  }
  if (nextPage <= totalPages) {
    availableRanges.push({ startPage: nextPage, endPage: totalPages });
  }
  return availableRanges;
}

export function allocateAvailablePages(
  totalPages: number,
  reservations: PageRange[],
  pageCount: number,
): PageRange[] | null {
  if (!Number.isInteger(pageCount) || pageCount < 1) return null;

  const allocation: PageRange[] = [];
  let pagesNeeded = pageCount;
  for (const range of getAvailableRanges(totalPages, reservations)) {
    const rangePageCount = range.endPage - range.startPage + 1;
    const allocatedPageCount = Math.min(rangePageCount, pagesNeeded);
    allocation.push({
      startPage: range.startPage,
      endPage: range.startPage + allocatedPageCount - 1,
    });
    pagesNeeded -= allocatedPageCount;
    if (pagesNeeded === 0) return allocation;
  }
  return null;
}
