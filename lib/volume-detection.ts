/**
 * Automatic volume detection for cup-shaped objects
 */

import { ParsedPly, getPositions } from './ply-parser';
import { fitCircleRANSAC, fitCylinder, CylinderFit } from './cylinder-fitting';

export interface VolumeDetectionResult {
  cylinder: CylinderFit;
  rimHeight: number;
  baseHeight: number;
  interiorVolume: number;  // in cubic units (same as input coordinates)
  orientation: 'upright' | 'inverted' | 'sideways';
}

/**
 * Compute covariance matrix for PCA
 */
function computeCovariance(positions: [number, number, number][]): number[][] {
  const n = positions.length;

  // Compute mean
  let meanX = 0, meanY = 0, meanZ = 0;
  for (const [x, y, z] of positions) {
    meanX += x;
    meanY += y;
    meanZ += z;
  }
  meanX /= n;
  meanY /= n;
  meanZ /= n;

  // Compute covariance
  let cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const [x, y, z] of positions) {
    const dx = x - meanX;
    const dy = y - meanY;
    const dz = z - meanZ;
    cov[0][0] += dx * dx;
    cov[0][1] += dx * dy;
    cov[0][2] += dx * dz;
    cov[1][1] += dy * dy;
    cov[1][2] += dy * dz;
    cov[2][2] += dz * dz;
  }
  cov[1][0] = cov[0][1];
  cov[2][0] = cov[0][2];
  cov[2][1] = cov[1][2];

  return cov.map(row => row.map(v => v / n));
}

/**
 * Simple power iteration to find dominant eigenvector
 */
function dominantEigenvector(cov: number[][]): [number, number, number] {
  let v: [number, number, number] = [1, 0, 0];

  for (let iter = 0; iter < 50; iter++) {
    // Matrix-vector multiply
    const newV: [number, number, number] = [
      cov[0][0] * v[0] + cov[0][1] * v[1] + cov[0][2] * v[2],
      cov[1][0] * v[0] + cov[1][1] * v[1] + cov[1][2] * v[2],
      cov[2][0] * v[0] + cov[2][1] * v[1] + cov[2][2] * v[2]
    ];

    // Normalize
    const len = Math.sqrt(newV[0] ** 2 + newV[1] ** 2 + newV[2] ** 2);
    v = [newV[0] / len, newV[1] / len, newV[2] / len];
  }

  return v;
}

/**
 * Detect cup orientation using PCA
 */
function detectOrientation(positions: [number, number, number][]): {
  axis: [number, number, number];
  orientation: 'upright' | 'inverted' | 'sideways';
} {
  const cov = computeCovariance(positions);
  const principal = dominantEigenvector(cov);

  // Check if principal axis is roughly vertical
  const verticalDot = Math.abs(principal[1]);

  if (verticalDot > 0.7) {
    // Cup is roughly upright or inverted
    return {
      axis: [0, 1, 0],
      orientation: principal[1] > 0 ? 'upright' : 'inverted'
    };
  } else {
    return {
      axis: principal,
      orientation: 'sideways'
    };
  }
}

/**
 * Slice points at a given height and return density info
 */
function sliceAtHeight(
  positions: [number, number, number][],
  height: number,
  thickness: number
): [number, number][] {
  return positions
    .filter(([, y]) => Math.abs(y - height) < thickness / 2)
    .map(([x, , z]) => [x, z] as [number, number]);
}

/**
 * Find the rim height (where the cup opening is)
 * The rim is where point density drops off significantly
 */
function findRimHeight(
  positions: [number, number, number][],
  minY: number,
  maxY: number,
  numSlices: number = 20
): number {
  const sliceThickness = (maxY - minY) / numSlices;
  const densities: { height: number; count: number }[] = [];

  for (let i = 0; i < numSlices; i++) {
    const height = minY + (i + 0.5) * sliceThickness;
    const slice = sliceAtHeight(positions, height, sliceThickness);
    densities.push({ height, count: slice.length });
  }

  // Find height where density drops significantly
  // The rim is typically where density suddenly decreases
  const maxDensity = Math.max(...densities.map(d => d.count));
  const threshold = maxDensity * 0.3;

  // Search from top down for significant density
  for (let i = densities.length - 1; i >= 0; i--) {
    if (densities[i].count > threshold) {
      return densities[i].height;
    }
  }

  return maxY;
}

/**
 * Detect interior volume of a cup
 */
export function detectVolume(ply: ParsedPly): VolumeDetectionResult | null {
  const positions = getPositions(ply);
  if (positions.length < 100) return null;

  // Detect orientation
  const { axis, orientation } = detectOrientation(positions);

  // Get height bounds
  const { min, max } = ply.bounds;
  const minY = min[1];
  const maxY = max[1];

  // Find rim height
  const rimHeight = findRimHeight(positions, minY, maxY);

  // Get points near the rim to fit a circle
  const rimPoints = sliceAtHeight(positions, rimHeight, (maxY - minY) * 0.1);
  const rimCircle = fitCircleRANSAC(rimPoints, 200, 0.05);

  if (!rimCircle) {
    // Fallback to full cylinder fit
    const cylinder = fitCylinder(positions);
    if (!cylinder) return null;

    const volume = Math.PI * cylinder.radius ** 2 * cylinder.height;

    return {
      cylinder,
      rimHeight: cylinder.center[1] + cylinder.height,
      baseHeight: cylinder.center[1],
      interiorVolume: volume,
      orientation
    };
  }

  // Estimate interior: cylinder from base to rim
  // The interior radius is slightly smaller than rim radius
  const interiorRadius = rimCircle.radius * 0.85;  // Assume wall thickness ~15%
  const baseHeight = minY;
  const height = rimHeight - baseHeight;

  const cylinder: CylinderFit = {
    center: [rimCircle.center[0], baseHeight, rimCircle.center[1]],
    radius: interiorRadius,
    height: Math.max(0.01, height),
    axis,
    confidence: 0.8
  };

  const volume = Math.PI * interiorRadius ** 2 * height;

  return {
    cylinder,
    rimHeight,
    baseHeight,
    interiorVolume: Math.max(0, volume),
    orientation
  };
}

/**
 * Convert volume from cubic units to milliliters
 * Assumes input units are in meters
 */
export function volumeToML(volumeCubicUnits: number, unitScale: number = 1): number {
  // 1 cubic meter = 1,000,000 mL
  // But splats are often in arbitrary units, so we need a scale factor
  return volumeCubicUnits * 1e6 * (unitScale ** 3);
}

/**
 * Estimate cup mass from geometry (assumes ceramic cup)
 */
export function estimateCupMass(
  outerRadius: number,
  height: number,
  wallThickness: number = 0.005,  // 5mm default
  density: number = 2400  // ceramic density kg/m³
): number {
  const innerRadius = outerRadius - wallThickness;
  const shellVolume = Math.PI * (outerRadius ** 2 - innerRadius ** 2) * height;
  const baseVolume = Math.PI * outerRadius ** 2 * wallThickness;
  return (shellVolume + baseVolume) * density;
}
