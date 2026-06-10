export interface ContourSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/**
 * Extract line segments where the scalar field crosses zero (2D grid, row-major).
 * Grid coordinates are cell indices; callers map to world space.
 */
export function marchingSquaresZeroContour(
  values: Float32Array,
  resolution: number,
): ContourSegment[] {
  const n = resolution;
  const segments: ContourSegment[] = [];

  const v = (col: number, row: number) => values[row * n + col];

  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const v00 = v(col, row);
      const v10 = v(col + 1, row);
      const v01 = v(col, row + 1);
      const v11 = v(col + 1, row + 1);

      const mask =
        (v00 < 0 ? 1 : 0) |
        (v10 < 0 ? 2 : 0) |
        (v11 < 0 ? 4 : 0) |
        (v01 < 0 ? 8 : 0);

      if (mask === 0 || mask === 15) continue;

      const tTop = v00 === v10 ? 0.5 : (0 - v00) / (v10 - v00);
      const tRight = v10 === v11 ? 0.5 : (0 - v10) / (v11 - v10);
      const tBottom = v01 === v11 ? 0.5 : (0 - v01) / (v11 - v01);
      const tLeft = v00 === v01 ? 0.5 : (0 - v00) / (v01 - v00);

      const top = { x: col + tTop, z: row };
      const right = { x: col + 1, z: row + tRight };
      const bottom = { x: col + tBottom, z: row + 1 };
      const left = { x: col, z: row + tLeft };

      const push = (a: { x: number; z: number }, b: { x: number; z: number }) => {
        segments.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
      };

      switch (mask) {
        case 1:
        case 14:
          push(left, top);
          break;
        case 2:
        case 13:
          push(top, right);
          break;
        case 3:
        case 12:
          push(left, right);
          break;
        case 4:
        case 11:
          push(right, bottom);
          break;
        case 5:
          push(left, bottom);
          push(top, right);
          break;
        case 6:
        case 9:
          push(top, bottom);
          break;
        case 7:
        case 8:
          push(left, bottom);
          break;
        case 10:
          push(top, bottom);
          break;
        default:
          break;
      }
    }
  }

  return segments;
}
