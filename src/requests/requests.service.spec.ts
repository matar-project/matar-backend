import {
  allocateAvailablePages,
  getAvailableRanges,
  getNextAvailableRange,
} from './page-allocation';

describe('page allocation', () => {
  it('returns an earlier released gap before later reservations', () => {
    expect(
      getNextAvailableRange(12, [
        { startPage: 4, endPage: 6 },
        { startPage: 7, endPage: 9 },
      ]),
    ).toEqual({ startPage: 1, endPage: 3 });
  });

  it('returns the first internal gap', () => {
    expect(
      getNextAvailableRange(12, [
        { startPage: 1, endPage: 3 },
        { startPage: 7, endPage: 9 },
      ]),
    ).toEqual({ startPage: 4, endPage: 6 });
  });

  it('returns null when every page is reserved or completed', () => {
    expect(
      getNextAvailableRange(6, [
        { startPage: 1, endPage: 3 },
        { startPage: 4, endPage: 6 },
      ]),
    ).toBeNull();
  });

  it('lists every available gap in page order', () => {
    expect(
      getAvailableRanges(35, [
        { startPage: 1, endPage: 20 },
        { startPage: 26, endPage: 30 },
      ]),
    ).toEqual([
      { startPage: 21, endPage: 25 },
      { startPage: 31, endPage: 35 },
    ]);
  });

  it('allocates a page count across multiple available ranges', () => {
    expect(
      allocateAvailablePages(
        35,
        [
          { startPage: 1, endPage: 20 },
          { startPage: 26, endPage: 30 },
        ],
        6,
      ),
    ).toEqual([
      { startPage: 21, endPage: 25 },
      { startPage: 31, endPage: 31 },
    ]);
  });

  it('returns null when the requested count exceeds all free pages', () => {
    expect(
      allocateAvailablePages(
        30,
        [
          { startPage: 1, endPage: 20 },
          { startPage: 26, endPage: 30 },
        ],
        6,
      ),
    ).toBeNull();
  });
});
