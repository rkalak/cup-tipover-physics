/**
 * Splat file parser
 * .splat format per gaussian (32 bytes):
 * - position: 3x float32 (x, y, z) = 12 bytes
 * - scale: 3x float32 = 12 bytes
 * - color: 4x uint8 (RGBA) = 4 bytes
 * - rotation: 4x uint8 (quaternion) = 4 bytes
 */

export interface SplatPoint {
  position: [number, number, number];
  scale: [number, number, number];
  color: [number, number, number, number];
  rotation: [number, number, number, number];
}

export interface ParsedSplat {
  points: SplatPoint[];
  positions: Float32Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
}

const BYTES_PER_GAUSSIAN = 32;

export function parseSplatFile(buffer: ArrayBuffer): ParsedSplat {
  const dataView = new DataView(buffer);
  const numGaussians = Math.floor(buffer.byteLength / BYTES_PER_GAUSSIAN);

  const points: SplatPoint[] = [];
  const positions = new Float32Array(numGaussians * 3);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < numGaussians; i++) {
    const offset = i * BYTES_PER_GAUSSIAN;

    // Read position (3x float32, little endian)
    const x = dataView.getFloat32(offset, true);
    const y = dataView.getFloat32(offset + 4, true);
    const z = dataView.getFloat32(offset + 8, true);

    // Read scale (3x float32)
    const sx = dataView.getFloat32(offset + 12, true);
    const sy = dataView.getFloat32(offset + 16, true);
    const sz = dataView.getFloat32(offset + 20, true);

    // Read color (4x uint8)
    const r = dataView.getUint8(offset + 24);
    const g = dataView.getUint8(offset + 25);
    const b = dataView.getUint8(offset + 26);
    const a = dataView.getUint8(offset + 27);

    // Read rotation (4x uint8, normalized to [-1, 1])
    const qx = (dataView.getUint8(offset + 28) - 128) / 128;
    const qy = (dataView.getUint8(offset + 29) - 128) / 128;
    const qz = (dataView.getUint8(offset + 30) - 128) / 128;
    const qw = (dataView.getUint8(offset + 31) - 128) / 128;

    // Skip invalid points
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    points.push({
      position: [x, y, z],
      scale: [sx, sy, sz],
      color: [r, g, b, a],
      rotation: [qx, qy, qz, qw]
    });

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return {
    points,
    positions,
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2
      ]
    }
  };
}

export function getPositions(splat: ParsedSplat): [number, number, number][] {
  return splat.points.map(p => p.position);
}
