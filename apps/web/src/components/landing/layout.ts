/**
 * Grid placement algorithm for the gallery: which cell in a `cols`-wide row
 * gets which image, row by row, until all images are placed. -1 marks an
 * empty spacer cell. Pulled out of Gallery.tsx because it's pure and exact
 * enough to be worth checking in isolation.
 */
export function buildLayout(count: number, cols: number): number[][] {
  const rows: number[][] = [];
  let placed = 0;
  let r = 0;

  while (placed < count) {
    const row = new Array(cols).fill(-1);

    const a = (r * 2 + (r % 2)) % cols;
    row[a] = placed;
    placed += 1;

    if (r % 3 === 0 && placed < count) {
      let b = (a + 2) % cols;
      if (b === a) b = (a + 1) % cols;
      row[b] = placed;
      placed += 1;
    }

    rows.push(row);
    r += 1;
  }

  return rows;
}
