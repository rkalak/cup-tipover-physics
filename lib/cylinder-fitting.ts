/**
 * Cylinder fitting using RANSAC-style approach
 */

export interface CylinderFit {
  center: [number, number, number];  // Center of cylinder base
  radius: number;
  height: number;
  axis: [number, number, number];    // Usually [0, 1, 0] for upright cup
  confidence: number;
}

export interface Circle2D {
  center: [number, number];
  radius: number;
}

/**
 * Fit a circle to 2D points using least squares
 */
export function fitCircle2D(points: [number, number][]): Circle2D | null {
  if (points.length < 3) return null;

  // Algebraic circle fit using least squares
  // Circle equation: (x-a)^2 + (y-b)^2 = r^2
  // Expanded: x^2 + y^2 = 2ax + 2by + (r^2 - a^2 - b^2)
  // Let c = r^2 - a^2 - b^2, solve for [a, b, c]

  const n = points.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  let sumXY = 0, sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;

  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    sumXY += x * y;
    sumX3 += x * x * x;
    sumY3 += y * y * y;
    sumX2Y += x * x * y;
    sumXY2 += x * y * y;
  }

  // Setup matrix equation: A * [a, b, c]^T = B
  const A = [
    [sumX2, sumXY, sumX],
    [sumXY, sumY2, sumY],
    [sumX, sumY, n]
  ];

  const B = [
    (sumX3 + sumXY2) / 2,
    (sumX2Y + sumY3) / 2,
    (sumX2 + sumY2) / 2
  ];

  // Solve using Cramer's rule
  const det = determinant3x3(A);
  if (Math.abs(det) < 1e-10) return null;

  const a = determinant3x3(replaceColumn(A, B, 0)) / det;
  const b = determinant3x3(replaceColumn(A, B, 1)) / det;
  const c = determinant3x3(replaceColumn(A, B, 2)) / det;

  const radius = Math.sqrt(c + a * a + b * b);

  if (!isFinite(radius) || radius <= 0) return null;

  return {
    center: [a, b],
    radius
  };
}

function determinant3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function replaceColumn(m: number[][], col: number[], idx: number): number[][] {
  return m.map((row, i) => row.map((val, j) => (j === idx ? col[i] : val)));
}

/**
 * RANSAC circle fitting for robustness
 */
export function fitCircleRANSAC(
  points: [number, number][],
  iterations: number = 100,
  threshold: number = 0.1
): Circle2D | null {
  if (points.length < 3) return null;

  let bestCircle: Circle2D | null = null;
  let bestInliers = 0;

  for (let iter = 0; iter < iterations; iter++) {
    // Random sample of 3 points
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * points.length));
    }
    const sample = Array.from(indices).map(i => points[i]);

    const circle = fitCircle2D(sample);
    if (!circle) continue;

    // Count inliers
    let inliers = 0;
    for (const [x, y] of points) {
      const dist = Math.abs(
        Math.sqrt((x - circle.center[0]) ** 2 + (y - circle.center[1]) ** 2) -
        circle.radius
      );
      if (dist < threshold) inliers++;
    }

    if (inliers > bestInliers) {
      bestInliers = inliers;
      bestCircle = circle;
    }
  }

  // Refit with all inliers
  if (bestCircle) {
    const inlierPoints = points.filter(([x, y]) => {
      const dist = Math.abs(
        Math.sqrt((x - bestCircle!.center[0]) ** 2 + (y - bestCircle!.center[1]) ** 2) -
        bestCircle!.radius
      );
      return dist < threshold;
    });

    if (inlierPoints.length >= 3) {
      const refined = fitCircle2D(inlierPoints);
      if (refined) bestCircle = refined;
    }
  }

  return bestCircle;
}

/**
 * Fit cylinder to 3D points (assuming roughly vertical orientation)
 */
export function fitCylinder(
  positions: [number, number, number][],
  axis: [number, number, number] = [0, 1, 0]
): CylinderFit | null {
  if (positions.length < 10) return null;

  // Project points to XZ plane (perpendicular to Y axis)
  const projectedPoints: [number, number][] = positions.map(([x, y, z]) => [x, z]);

  // Fit circle to projected points using RANSAC
  const circle = fitCircleRANSAC(projectedPoints, 200, 0.05);
  if (!circle) return null;

  // Find height extent
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of positions) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const height = maxY - minY;
  if (height <= 0) return null;

  // Calculate confidence based on how well points fit
  let totalError = 0;
  for (const [x, , z] of positions) {
    const dist = Math.sqrt((x - circle.center[0]) ** 2 + (z - circle.center[1]) ** 2);
    totalError += Math.abs(dist - circle.radius);
  }
  const avgError = totalError / positions.length;
  const confidence = Math.max(0, 1 - avgError / circle.radius);

  return {
    center: [circle.center[0], minY, circle.center[1]],
    radius: circle.radius,
    height,
    axis,
    confidence
  };
}
