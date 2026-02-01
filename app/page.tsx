'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import FileUpload from '@/components/FileUpload';
import PhysicsControls from '@/components/PhysicsControls';
import TipoverIndicator from '@/components/TipoverIndicator';
import CylinderControls, { CylinderAdjustments, defaultAdjustments } from '@/components/CylinderControls';
import { parsePlyFile, ParsedPly } from '@/lib/ply-parser';
import { detectVolume, VolumeDetectionResult, volumeToML, estimateCupMass } from '@/lib/volume-detection';
import { calculatePhysicsState, PhysicsState, toRadians, CylinderParams } from '@/lib/tipover-physics';
import { CylinderFit } from '@/lib/cylinder-fitting';
import { Beaker, RotateCcw, Info, ChevronDown, ChevronRight } from 'lucide-react';

// Dynamic import for PlyViewer to avoid SSR issues with Three.js
const PlyViewer = dynamic(() => import('@/components/SplatViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-gray-900 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading 3D viewer...</div>
    </div>
  )
});

// Estimate a reasonable unit scale based on detected dimensions
function estimateUnitScale(cylinder: CylinderFit): number {
  const detectedHeight = cylinder.height;

  if (detectedHeight < 0.5) {
    return 1; // meters
  } else if (detectedHeight < 50) {
    return 0.01; // centimeters
  } else {
    return 0.001; // millimeters
  }
}

export default function Home() {
  const [plyBuffer, setPlyBuffer] = useState<ArrayBuffer | null>(null);
  const [parsedPly, setParsedPly] = useState<ParsedPly | null>(null);
  const [volumeResult, setVolumeResult] = useState<VolumeDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fillLevel, setFillLevel] = useState(0.65);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cylinderAdjustments, setCylinderAdjustments] = useState<CylinderAdjustments>(defaultAdjustments);
  const [showCylinderControls, setShowCylinderControls] = useState(false);

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    setIsLoading(true);
    setError(null);
    setCylinderAdjustments(defaultAdjustments); // Reset adjustments on new file

    try {
      const parsed = parsePlyFile(buffer);
      setParsedPly(parsed);
      setPlyBuffer(buffer);

      const volume = detectVolume(parsed);
      if (volume) {
        setVolumeResult(volume);
      } else {
        setError('Could not detect cup interior. Try a different PLY file.');
      }
    } catch (err) {
      console.error('Error processing PLY:', err);
      setError('Failed to parse PLY file. Make sure it\'s a valid .ply format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setFillLevel(0.65);
    setTiltAngle(0);
    setCylinderAdjustments(defaultAdjustments);
  }, []);

  // Get adjusted cylinder for physics calculations
  const adjustedCylinder = useMemo((): CylinderFit | null => {
    if (!volumeResult) return null;
    const cyl = volumeResult.cylinder;
    const adj = cylinderAdjustments;

    return {
      ...cyl,
      center: [
        cyl.center[0] + adj.offsetX,
        cyl.center[1] + adj.offsetY,
        cyl.center[2] + adj.offsetZ
      ],
      radius: cyl.radius * adj.radiusScale,
      height: cyl.height * adj.heightScale
    };
  }, [volumeResult, cylinderAdjustments]);

  // Calculate physics state using adjusted cylinder
  const physicsState = useMemo((): PhysicsState | null => {
    if (!adjustedCylinder) return null;

    const unitScale = estimateUnitScale(adjustedCylinder);

    const cylinderParams: CylinderParams = {
      center: {
        x: adjustedCylinder.center[0],
        y: adjustedCylinder.center[1],
        z: adjustedCylinder.center[2]
      },
      radius: adjustedCylinder.radius,
      height: adjustedCylinder.height
    };

    const cupMass = estimateCupMass(
      adjustedCylinder.radius * unitScale,
      adjustedCylinder.height * unitScale
    );

    return calculatePhysicsState(
      cylinderParams,
      fillLevel,
      toRadians(tiltAngle),
      cupMass,
      1000
    );
  }, [adjustedCylinder, fillLevel, tiltAngle]);

  // Calculate volume in mL using adjusted cylinder
  const volumeML = useMemo((): number => {
    if (!adjustedCylinder) return 0;
    const unitScale = estimateUnitScale(adjustedCylinder);
    const volume = Math.PI * adjustedCylinder.radius ** 2 * adjustedCylinder.height;
    return volumeToML(volume, unitScale);
  }, [adjustedCylinder]);

  const unitScale = adjustedCylinder ? estimateUnitScale(adjustedCylinder) : 1;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Beaker className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold">Cup Pour Dynamics Analyzer</h1>
          </div>
          {volumeResult && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {!plyBuffer ? (
          // Upload state
          <div className="max-w-xl mx-auto mt-20">
            <FileUpload onFileLoaded={handleFileLoaded} isLoading={isLoading} />
            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-2">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Upload a PLY point cloud (.ply) file of a cup</li>
                    <li>The app automatically detects the cup's interior volume</li>
                    <li>Adjust cylinder alignment manually if needed</li>
                    <li>Adjust fill level and tilt angle to simulate pouring</li>
                    <li>View spill analysis and stability status in real-time</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Main app state
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3D Viewer */}
            <div className="lg:col-span-2">
              <div className="bg-gray-900 rounded-xl overflow-hidden" style={{ height: '500px' }}>
                <PlyViewer
                  plyBuffer={plyBuffer}
                  cylinder={volumeResult?.cylinder || null}
                  cylinderAdjustments={cylinderAdjustments}
                  physicsState={physicsState}
                  tiltAngle={tiltAngle}
                />
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Controls Panel */}
            <div className="space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto pr-2">
              {/* File Upload */}
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-3">PLY File</h2>
                <FileUpload onFileLoaded={handleFileLoaded} isLoading={isLoading} />
              </div>

              {/* Manual Cylinder Adjustments */}
              <div className="bg-gray-900 rounded-xl p-4">
                <button
                  onClick={() => setShowCylinderControls(!showCylinderControls)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <span>Cylinder Alignment</span>
                  {showCylinderControls ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {showCylinderControls && (
                  <div className="mt-4">
                    <CylinderControls
                      adjustments={cylinderAdjustments}
                      onChange={setCylinderAdjustments}
                      bounds={parsedPly?.bounds || null}
                      disabled={!volumeResult}
                    />
                  </div>
                )}
              </div>

              {/* Physics Controls */}
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-4">Pour Simulation</h2>
                <PhysicsControls
                  fillLevel={fillLevel}
                  tiltAngle={tiltAngle}
                  onFillLevelChange={setFillLevel}
                  onTiltAngleChange={setTiltAngle}
                  disabled={!volumeResult}
                />
              </div>

              {/* Statistics */}
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-4">Analysis</h2>
                <TipoverIndicator
                  physicsState={physicsState}
                  volume={volumeML}
                  unitScale={unitScale}
                />
              </div>

              {/* Detection Info */}
              {adjustedCylinder && (
                <div className="bg-gray-900 rounded-xl p-4">
                  <h2 className="text-sm font-medium text-gray-400 mb-3">Cylinder Info</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Orientation</span>
                      <span className="text-gray-300 capitalize">{volumeResult?.orientation || 'unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cylinder Radius</span>
                      <span className="text-gray-300">
                        {(adjustedCylinder.radius * unitScale * 100).toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cylinder Height</span>
                      <span className="text-gray-300">
                        {(adjustedCylinder.height * unitScale * 100).toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence</span>
                      <span className="text-gray-300">
                        {(adjustedCylinder.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
