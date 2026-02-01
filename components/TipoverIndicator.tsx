'use client';

import { PhysicsState, toDegrees } from '@/lib/tipover-physics';
import { CheckCircle, AlertTriangle, Droplets } from 'lucide-react';

interface TipoverIndicatorProps {
  physicsState: PhysicsState | null;
  volume: number;  // in ml
  unitScale?: number;
}

export default function TipoverIndicator({
  physicsState,
  volume,
  unitScale = 1
}: TipoverIndicatorProps) {
  if (!physicsState) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Volume" value="--" unit="ml" />
        <StatCard title="Center of Mass" value="--" unit="cm" />
        <StatCard title="Tipover Angle" value="--" unit="°" />
      </div>
    );
  }

  const comHeight = (physicsState.centerOfMass.y * unitScale * 100).toFixed(1);
  const criticalAngle = toDegrees(physicsState.criticalTipoverAngle).toFixed(0);
  const liquidVolume = (physicsState.liquidVolume * 1e6 * (unitScale ** 3)).toFixed(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Volume"
          value={volume.toFixed(0)}
          unit="ml"
          subValue={`Filled: ${liquidVolume} ml`}
        />
        <StatCard
          title="Center of Mass"
          value={comHeight}
          unit="cm"
        />
        <StatCard
          title="Tipover Angle"
          value={criticalAngle}
          unit="°"
          highlight
        />
      </div>

      <StatusBanner
        isStable={physicsState.isStable}
        margin={physicsState.stabilityMargin}
        isSpilling={physicsState.volumePoured > 0}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  unit,
  subValue,
  highlight
}: {
  title: string;
  value: string;
  unit: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${highlight ? 'ring-2 ring-blue-500' : ''}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {value}
        <span className="text-sm text-gray-400 ml-1">{unit}</span>
      </p>
      {subValue && (
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      )}
    </div>
  );
}

function StatusBanner({
  isStable,
  margin,
  isSpilling
}: {
  isStable: boolean;
  margin: number;
  isSpilling: boolean;
}) {
  if (isSpilling) {
    return (
      <div className="flex items-center gap-3 bg-blue-900/50 border border-blue-500 rounded-lg p-4">
        <Droplets className="w-6 h-6 text-blue-400" />
        <div>
          <p className="font-medium text-blue-300">Liquid Spilling</p>
          <p className="text-sm text-blue-400/70">
            Tilt angle exceeds liquid containment
          </p>
        </div>
      </div>
    );
  }

  if (isStable) {
    return (
      <div className="flex items-center gap-3 bg-green-900/50 border border-green-500 rounded-lg p-4">
        <CheckCircle className="w-6 h-6 text-green-400" />
        <div>
          <p className="font-medium text-green-300">Stable</p>
          <p className="text-sm text-green-400/70">
            {margin.toFixed(0)}° margin before tipover
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-red-900/50 border border-red-500 rounded-lg p-4">
      <AlertTriangle className="w-6 h-6 text-red-400" />
      <div>
        <p className="font-medium text-red-300">Tipping Over!</p>
        <p className="text-sm text-red-400/70">
          Center of mass past base edge
        </p>
      </div>
    </div>
  );
}
