/**
 * PLY file parser for point cloud data
 * Supports both ASCII and binary PLY formats
 */

export interface PlyPoint {
  position: [number, number, number];
  color?: [number, number, number, number];
  normal?: [number, number, number];
}

export interface ParsedPly {
  points: PlyPoint[];
  positions: Float32Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
  vertexCount: number;
}

interface PlyHeader {
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  vertexCount: number;
  properties: PlyProperty[];
  headerLength: number;
}

interface PlyProperty {
  name: string;
  type: string;
  isList?: boolean;
  countType?: string;
}

const TYPE_SIZES: Record<string, number> = {
  'char': 1, 'int8': 1,
  'uchar': 1, 'uint8': 1,
  'short': 2, 'int16': 2,
  'ushort': 2, 'uint16': 2,
  'int': 4, 'int32': 4,
  'uint': 4, 'uint32': 4,
  'float': 4, 'float32': 4,
  'double': 8, 'float64': 8,
};

function parseHeader(text: string): PlyHeader {
  const lines = text.split('\n');
  let format: PlyHeader['format'] = 'ascii';
  let vertexCount = 0;
  const properties: PlyProperty[] = [];
  let headerLength = 0;
  let inVertexElement = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    headerLength += lines[i].length + 1; // +1 for newline

    if (line === 'end_header') {
      break;
    }

    if (line.startsWith('format ')) {
      const formatStr = line.split(' ')[1];
      if (formatStr === 'ascii') format = 'ascii';
      else if (formatStr === 'binary_little_endian') format = 'binary_little_endian';
      else if (formatStr === 'binary_big_endian') format = 'binary_big_endian';
    }

    if (line.startsWith('element vertex ')) {
      vertexCount = parseInt(line.split(' ')[2], 10);
      inVertexElement = true;
    } else if (line.startsWith('element ')) {
      inVertexElement = false;
    }

    if (inVertexElement && line.startsWith('property ')) {
      const parts = line.split(' ');
      if (parts[1] === 'list') {
        properties.push({
          name: parts[4],
          type: parts[3],
          isList: true,
          countType: parts[2]
        });
      } else {
        properties.push({
          name: parts[2],
          type: parts[1]
        });
      }
    }
  }

  return { format, vertexCount, properties, headerLength };
}

function getPropertyIndex(properties: PlyProperty[], ...names: string[]): number {
  for (const name of names) {
    const idx = properties.findIndex(p => p.name === name);
    if (idx !== -1) return idx;
  }
  return -1;
}

function readValue(
  dataView: DataView,
  offset: number,
  type: string,
  littleEndian: boolean
): { value: number; size: number } {
  const size = TYPE_SIZES[type] || 4;

  switch (type) {
    case 'char':
    case 'int8':
      return { value: dataView.getInt8(offset), size };
    case 'uchar':
    case 'uint8':
      return { value: dataView.getUint8(offset), size };
    case 'short':
    case 'int16':
      return { value: dataView.getInt16(offset, littleEndian), size };
    case 'ushort':
    case 'uint16':
      return { value: dataView.getUint16(offset, littleEndian), size };
    case 'int':
    case 'int32':
      return { value: dataView.getInt32(offset, littleEndian), size };
    case 'uint':
    case 'uint32':
      return { value: dataView.getUint32(offset, littleEndian), size };
    case 'float':
    case 'float32':
      return { value: dataView.getFloat32(offset, littleEndian), size };
    case 'double':
    case 'float64':
      return { value: dataView.getFloat64(offset, littleEndian), size };
    default:
      return { value: 0, size: 4 };
  }
}

function parseBinary(
  buffer: ArrayBuffer,
  header: PlyHeader
): ParsedPly {
  const dataView = new DataView(buffer);
  const littleEndian = header.format === 'binary_little_endian';
  const points: PlyPoint[] = [];
  const positions = new Float32Array(header.vertexCount * 3);

  // Find property indices
  const xIdx = getPropertyIndex(header.properties, 'x');
  const yIdx = getPropertyIndex(header.properties, 'y');
  const zIdx = getPropertyIndex(header.properties, 'z');
  const rIdx = getPropertyIndex(header.properties, 'red', 'r');
  const gIdx = getPropertyIndex(header.properties, 'green', 'g');
  const bIdx = getPropertyIndex(header.properties, 'blue', 'b');
  const aIdx = getPropertyIndex(header.properties, 'alpha', 'a');

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let offset = header.headerLength;

  for (let i = 0; i < header.vertexCount; i++) {
    const values: number[] = [];

    for (const prop of header.properties) {
      if (prop.isList) {
        // Skip list properties (like face indices)
        const countResult = readValue(dataView, offset, prop.countType!, littleEndian);
        offset += countResult.size;
        for (let j = 0; j < countResult.value; j++) {
          const result = readValue(dataView, offset, prop.type, littleEndian);
          offset += result.size;
        }
        values.push(0);
      } else {
        const result = readValue(dataView, offset, prop.type, littleEndian);
        values.push(result.value);
        offset += result.size;
      }
    }

    const x = xIdx >= 0 ? values[xIdx] : 0;
    const y = yIdx >= 0 ? values[yIdx] : 0;
    const z = zIdx >= 0 ? values[zIdx] : 0;

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const point: PlyPoint = {
      position: [x, y, z]
    };

    if (rIdx >= 0 && gIdx >= 0 && bIdx >= 0) {
      const r = values[rIdx];
      const g = values[gIdx];
      const b = values[bIdx];
      const a = aIdx >= 0 ? values[aIdx] : 255;
      // Normalize to 0-255 if values are floats
      const normalize = (v: number) => v <= 1 ? Math.round(v * 255) : v;
      point.color = [normalize(r), normalize(g), normalize(b), normalize(a)];
    }

    points.push(point);

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
    },
    vertexCount: points.length
  };
}

function parseAscii(
  text: string,
  header: PlyHeader
): ParsedPly {
  const lines = text.split('\n');
  const points: PlyPoint[] = [];
  const positions = new Float32Array(header.vertexCount * 3);

  // Find property indices
  const xIdx = getPropertyIndex(header.properties, 'x');
  const yIdx = getPropertyIndex(header.properties, 'y');
  const zIdx = getPropertyIndex(header.properties, 'z');
  const rIdx = getPropertyIndex(header.properties, 'red', 'r');
  const gIdx = getPropertyIndex(header.properties, 'green', 'g');
  const bIdx = getPropertyIndex(header.properties, 'blue', 'b');
  const aIdx = getPropertyIndex(header.properties, 'alpha', 'a');

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Find start of vertex data
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'end_header') {
      startLine = i + 1;
      break;
    }
  }

  let pointIndex = 0;
  for (let i = startLine; i < lines.length && pointIndex < header.vertexCount; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(/\s+/).map(parseFloat);
    if (values.length < header.properties.length) continue;

    const x = xIdx >= 0 ? values[xIdx] : 0;
    const y = yIdx >= 0 ? values[yIdx] : 0;
    const z = zIdx >= 0 ? values[zIdx] : 0;

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

    positions[pointIndex * 3] = x;
    positions[pointIndex * 3 + 1] = y;
    positions[pointIndex * 3 + 2] = z;

    const point: PlyPoint = {
      position: [x, y, z]
    };

    if (rIdx >= 0 && gIdx >= 0 && bIdx >= 0) {
      const r = values[rIdx];
      const g = values[gIdx];
      const b = values[bIdx];
      const a = aIdx >= 0 ? values[aIdx] : 255;
      const normalize = (v: number) => v <= 1 ? Math.round(v * 255) : v;
      point.color = [normalize(r), normalize(g), normalize(b), normalize(a)];
    }

    points.push(point);
    pointIndex++;

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
    },
    vertexCount: points.length
  };
}

export function parsePlyFile(buffer: ArrayBuffer): ParsedPly {
  // Read enough bytes for header (typically < 1KB)
  const headerBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
  const headerText = new TextDecoder().decode(headerBytes);

  // Check for PLY magic number
  if (!headerText.startsWith('ply')) {
    throw new Error('Invalid PLY file: missing magic number');
  }

  const header = parseHeader(headerText);

  if (header.format === 'ascii') {
    const fullText = new TextDecoder().decode(buffer);
    return parseAscii(fullText, header);
  } else {
    return parseBinary(buffer, header);
  }
}

export function getPositions(ply: ParsedPly): [number, number, number][] {
  return ply.points.map(p => p.position);
}
