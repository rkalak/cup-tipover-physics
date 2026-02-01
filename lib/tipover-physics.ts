/**
 * Tipover physics calculations
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CylinderParams {
  center: Vector3;      // Base center
  radius: number;
  height: number;
}

export interface PhysicsState {
  fillLevel: number;           // 0-1
  tiltAngle: number;           // radians
  centerOfMass: Vector3;
  criticalTipoverAngle: number; // radians
  liquidVolume: number;
  volumePoured: number;
  isStable: boolean;
  stabilityMargin: number;     // degrees
}

/**
 * Calculate center of mass for cup + liquid system
 */
export function calculateCenterOfMass(
  cupMass: number,
  cupCentroid: Vector3,
  liquidVolume: number,
  liquidDensity: number,
  liquidCentroid: Vector3
): Vector3 {
  const liquidMass = liquidVolume * liquidDensity;
  const totalMass = cupMass + liquidMass;

  if (totalMass === 0) return cupCentroid;

  return {
    x: (cupMass * cupCentroid.x + liquidMass * liquidCentroid.x) / totalMass,
    y: (cupMass * cupCentroid.y + liquidMass * liquidCentroid.y) / totalMass,
    z: (cupMass * cupCentroid.z + liquidMass * liquidCentroid.z) / totalMass
  };
}

/**
 * Calculate the liquid centroid for a given fill level
 * Assumes liquid fills from bottom as a cylinder
 */
export function calculateLiquidCentroid(
  cylinder: CylinderParams,
  fillLevel: number
): Vector3 {
  const liquidHeight = cylinder.height * fillLevel;
  return {
    x: cylinder.center.x,
    y: cylinder.center.y + liquidHeight / 2,
    z: cylinder.center.z
  };
}

/**
 * Calculate liquid volume at a given fill level
 */
export function calculateLiquidVolume(
  cylinder: CylinderParams,
  fillLevel: number
): number {
  const liquidHeight = cylinder.height * fillLevel;
  return Math.PI * cylinder.radius ** 2 * liquidHeight;
}

/**
 * Calculate the critical tipover angle
 * Cup tips when center of mass passes over base edge
 */
export function criticalTipoverAngle(
  centerOfMass: Vector3,
  baseRadius: number,
  baseCenter: Vector3
): number {
  // Distance from CoM to base center in horizontal plane
  const horizontalDist = Math.sqrt(
    (centerOfMass.x - baseCenter.x) ** 2 +
    (centerOfMass.z - baseCenter.z) ** 2
  );

  // Vertical distance from base to CoM
  const verticalDist = centerOfMass.y - baseCenter.y;

  if (verticalDist <= 0) {
    return Math.PI / 2; // CoM at or below base, very stable
  }

  // Angle where CoM is directly above base edge
  // When tilted, the effective base width decreases
  // Critical angle: tan(theta) = (baseRadius - horizontalDist) / verticalDist
  const effectiveRadius = baseRadius - horizontalDist;

  if (effectiveRadius <= 0) {
    return 0; // Already unstable
  }

  return Math.atan2(effectiveRadius, verticalDist);
}

/**
 * Calculate volume of liquid that has poured out at a given tilt angle
 */
export function volumePoured(
  tiltAngle: number,
  cylinder: CylinderParams,
  fillLevel: number
): number {
  if (tiltAngle <= 0) return 0;

  const liquidHeight = cylinder.height * fillLevel;
  const r = cylinder.radius;

  // When tilted, the liquid surface stays horizontal
  // The rim on the low side drops below liquid level

  // Height of liquid above rim on the low side
  const rimDropOnLowSide = 2 * r * Math.sin(tiltAngle);
  const liquidHeightAboveRim = liquidHeight * Math.cos(tiltAngle) -
    (cylinder.height - liquidHeight) * Math.tan(tiltAngle);

  if (liquidHeightAboveRim <= 0) return 0;

  // Approximate: volume of liquid above tilted rim plane
  // This is a complex integral; we approximate with a simpler formula

  // The spilled volume is approximately a wedge
  const spillHeight = Math.min(liquidHeightAboveRim, rimDropOnLowSide);
  const spillVolume = spillHeight * r * r * Math.sin(tiltAngle);

  return Math.max(0, spillVolume);
}

/**
 * Calculate liquid surface height on both sides when tilted
 */
export function getLiquidSurfaceWhenTilted(
  tiltAngle: number,
  cylinder: CylinderParams,
  fillLevel: number
): { highSide: number; lowSide: number; spilling: boolean } {
  const liquidHeight = cylinder.height * fillLevel;
  const r = cylinder.radius;

  // Liquid surface stays horizontal, so it rises on one side and drops on other
  const heightChange = r * Math.tan(tiltAngle);

  const highSide = liquidHeight + heightChange;
  const lowSide = liquidHeight - heightChange;

  // Spilling occurs when liquid on high side exceeds cylinder height
  const spilling = highSide > cylinder.height && lowSide < cylinder.height;

  return {
    highSide: Math.min(highSide, cylinder.height),
    lowSide: Math.max(0, lowSide),
    spilling: spilling || lowSide <= 0
  };
}

/**
 * Calculate complete physics state for given parameters
 */
export function calculatePhysicsState(
  cylinder: CylinderParams,
  fillLevel: number,
  tiltAngle: number,
  cupMass: number = 0.3,         // 300g default cup mass
  liquidDensity: number = 1000   // water: 1000 kg/m³
): PhysicsState {
  // Clamp inputs
  fillLevel = Math.max(0, Math.min(1, fillLevel));
  tiltAngle = Math.max(0, Math.min(Math.PI / 2, tiltAngle));

  // Cup centroid (assuming uniform wall thickness, centroid is at center)
  const cupCentroid: Vector3 = {
    x: cylinder.center.x,
    y: cylinder.center.y + cylinder.height / 2,
    z: cylinder.center.z
  };

  // Liquid calculations
  const liquidVolume = calculateLiquidVolume(cylinder, fillLevel);
  const liquidCentroid = calculateLiquidCentroid(cylinder, fillLevel);

  // Center of mass
  const centerOfMass = calculateCenterOfMass(
    cupMass,
    cupCentroid,
    liquidVolume,
    liquidDensity,
    liquidCentroid
  );

  // Base center for tipover calculation
  const baseCenter: Vector3 = {
    x: cylinder.center.x,
    y: cylinder.center.y,
    z: cylinder.center.z
  };

  // Critical angle
  const criticalAngle = criticalTipoverAngle(
    centerOfMass,
    cylinder.radius,
    baseCenter
  );

  // Poured volume
  const poured = volumePoured(tiltAngle, cylinder, fillLevel);

  // Stability
  const isStable = tiltAngle < criticalAngle;
  const stabilityMargin = (criticalAngle - tiltAngle) * (180 / Math.PI);

  return {
    fillLevel,
    tiltAngle,
    centerOfMass,
    criticalTipoverAngle: criticalAngle,
    liquidVolume,
    volumePoured: poured,
    isStable,
    stabilityMargin
  };
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
