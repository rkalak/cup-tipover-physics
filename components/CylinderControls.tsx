'use client';

import { Settings2 } from 'lucide-react';

export interface CylinderAdjustments {
  // Rotation in degrees around each axis
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  // Position offset
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  // Scale adjustments
  radiusScale: number;
  heightScale: number;
}

export const defaultAdjustments: CylinderAdjustments = {
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  radiusScale: 1,
  heightScale: 1,
};

interface CylinderControlsProps {
  adjustments: CylinderAdjustments;
  onChange: (adjustments: CylinderAdjustments) => void;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
  disabled?: boolean;
}

export default function CylinderControls({
  adjustments,
  onChange,
  bounds,
  disabled = false
}: CylinderControlsProps) {
  const updateField = (field: keyof CylinderAdjustments, value: number) => {
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
        <Settings2 className="w-3 h-3" />
        <span>Manual cylinder adjustments</span>
      </div>

      {/* Axis Rotation */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Axis Rotation</h3>

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
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Position Offset</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Offset X</label>
            <span className="text-xs text-gray-400">{adjustments.offsetX.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={-range}
            max={range}
            step={range / 200}
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
            min={-range}
            max={range}
            step={range / 200}
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
            min={-range}
            max={range}
            step={range / 200}
            value={adjustments.offsetZ}
            onChange={(e) => updateField('offsetZ', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Size Adjustments */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Size</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Radius Scale</label>
            <span className="text-xs text-gray-400">{(adjustments.radiusScale * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={adjustments.radiusScale}
            onChange={(e) => updateField('radiusScale', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-gray-500">Height Scale</label>
            <span className="text-xs text-gray-400">{(adjustments.heightScale * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={adjustments.heightScale}
            onChange={(e) => updateField('heightScale', Number(e.target.value))}
            className="w-full h-1"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onChange(defaultAdjustments)}
        className="w-full py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        disabled={disabled}
      >
        Reset Adjustments
      </button>
    </div>
  );
}
