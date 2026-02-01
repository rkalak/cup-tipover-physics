'use client';

interface PhysicsControlsProps {
  fillLevel: number;
  tiltAngle: number;
  onFillLevelChange: (level: number) => void;
  onTiltAngleChange: (angle: number) => void;
  disabled?: boolean;
}

export default function PhysicsControls({
  fillLevel,
  tiltAngle,
  onFillLevelChange,
  onTiltAngleChange,
  disabled = false
}: PhysicsControlsProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Fill Level</label>
          <span className="text-sm text-blue-400">{Math.round(fillLevel * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={fillLevel * 100}
          onChange={(e) => onFillLevelChange(Number(e.target.value) / 100)}
          className="w-full"
          disabled={disabled}
        />
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Tilt Angle</label>
          <span className="text-sm text-orange-400">{Math.round(tiltAngle)}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="90"
          value={tiltAngle}
          onChange={(e) => onTiltAngleChange(Number(e.target.value))}
          className="w-full"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
