'use client';

import { Box } from 'lucide-react';

export interface PlyAdjustments {
  // Rotation in degrees around each axis
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  // Position offset
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  // Uniform scale
  scale: number;
}

export const defaultPlyAdjustments: PlyAdjustments = {
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  scale: 1,
};

interface PlyControlsProps {
  adjustments: PlyAdjustments;
  onChange: (adjustments: PlyAdjustments) => void;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
  disabled?: boolean;
}

export default function PlyControls({
  adjustments,
  onChange,
  bounds,
  disabled = false
}: PlyControlsProps) {
  const updateField = (field: keyof PlyAdjustments, value: number) => {
    onChange({ ...adjustments, [field]: value });
  };

  // Calculate reasonable offset ranges based on bounds
  const range = bounds ? Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  ) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Box className="w-3 h-3" />
        <span>Manual point cloud adjustments</span>
      </div>

      {/* Rotation */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Rotation</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Rotate X</label>
            <span className="text-xs text-gray-400">{adjustments.rotationX}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={adjustments.rotationX}
            onChange={(e) => updateField('rotationX', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Rotate Y</label>
            <span className="text-xs text-gray-400">{adjustments.rotationY}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={adjustments.rotationY}
            onChange={(e) => updateField('rotationY', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Rotate Z</label>
            <span className="text-xs text-gray-400">{adjustments.rotationZ}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={adjustments.rotationZ}
            onChange={(e) => updateField('rotationZ', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Position Offset */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Position</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Offset X</label>
            <span className="text-xs text-gray-400">{adjustments.offsetX.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={-range * 2}
            max={range * 2}
            step={range / 100}
            value={adjustments.offsetX}
            onChange={(e) => updateField('offsetX', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Offset Y</label>
            <span className="text-xs text-gray-400">{adjustments.offsetY.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={-range * 2}
            max={range * 2}
            step={range / 100}
            value={adjustments.offsetY}
            onChange={(e) => updateField('offsetY', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Offset Z</label>
            <span className="text-xs text-gray-400">{adjustments.offsetZ.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={-range * 2}
            max={range * 2}
            step={range / 100}
            value={adjustments.offsetZ}
            onChange={(e) => updateField('offsetZ', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Scale */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Scale</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Uniform Scale</label>
            <span className="text-xs text-gray-400">{(adjustments.scale * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.05"
            value={adjustments.scale}
            onChange={(e) => updateField('scale', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onChange(defaultPlyAdjustments)}
        className="w-full py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        disabled={disabled}
      >
        Reset Adjustments
      </button>
    </div>
  );
}
