'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import FileUpload from '@/components/FileUpload';
import PhysicsControls from '@/components/PhysicsControls';
import TipoverIndicator from '@/components/TipoverIndicator';
import { parseSplatFile, ParsedSplat } from '@/lib/splat-parser';
import { detectVolume, VolumeDetectionResult, volumeToML, estimateCupMass } from '@/lib/volume-detection';
import { calculatePhysicsState, PhysicsState, toRadians, CylinderParams } from '@/lib/tipover-physics';
import { CylinderFit } from '@/lib/cylinder-fitting';
import { Beaker, RotateCcw, Info } from 'lucide-react';

// Dynamic import for SplatViewer to avoid SSR issues with Three.js
const SplatViewer = dynamic(() => import('@/components/SplatViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-gray-900 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading 3D viewer...</div>
    </div>
  )
});

// Estimate a reasonable unit scale based on detected dimensions
function estimateUnitScale(cylinder: CylinderFit): number {
  // Typical cup dimensions: height 8-12cm, diameter 7-10cm
  // If detected height is around 0.1, units are likely meters
  // If detected height is around 10, units are likely centimeters
  // If detected height is around 100, units are likely millimeters

  const typicalCupHeight = 0.1; // 10cm in meters
  const detectedHeight = cylinder.height;

  if (detectedHeight < 0.5) {
    // Likely meters
    return 1;
  } else if (detectedHeight < 50) {
    // Likely centimeters
    return 0.01;
  } else {
    // Likely millimeters
    return 0.001;
  }
}

export default function Home() {
  const [splatBuffer, setSplatBuffer] = useState<ArrayBuffer | null>(null);
  const [parsedSplat, setParsedSplat] = useState<ParsedSplat | null>(null);
  const [volumeResult, setVolumeResult] = useState<VolumeDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fillLevel, setFillLevel] = useState(0.65);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Parse splat file
      const parsed = parseSplatFile(buffer);
      setParsedSplat(parsed);
      setSplatBuffer(buffer);

      // Detect volume
      const volume = detectVolume(parsed);
      if (volume) {
        setVolumeResult(volume);
      } else {
        setError('Could not detect cup interior. Try a different splat file.');
      }
    } catch (err) {
      console.error('Error processing splat:', err);
      setError('Failed to parse splat file. Make sure it\'s a valid .splat format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setFillLevel(0.65);
    setTiltAngle(0);
  }, []);

  // Calculate physics state
  const physicsState = useMemo((): PhysicsState | null => {
    if (!volumeResult) return null;

    const cylinder = volumeResult.cylinder;
    const unitScale = estimateUnitScale(cylinder);

    const cylinderParams: CylinderParams = {
      center: {
        x: cylinder.center[0],
        y: cylinder.center[1],
        z: cylinder.center[2]
      },
      radius: cylinder.radius,
      height: cylinder.height
    };

    // Estimate cup mass based on geometry
    const cupMass = estimateCupMass(
      cylinder.radius * unitScale,
      cylinder.height * unitScale
    );

    return calculatePhysicsState(
      cylinderParams,
      fillLevel,
      toRadians(tiltAngle),
      cupMass,
      1000 // water density
    );
  }, [volumeResult, fillLevel, tiltAngle]);

  // Calculate volume in mL
  const volumeML = useMemo((): number => {
    if (!volumeResult) return 0;
    const unitScale = estimateUnitScale(volumeResult.cylinder);
    return volumeToML(volumeResult.interiorVolume, unitScale);
  }, [volumeResult]);

  const unitScale = volumeResult ? estimateUnitScale(volumeResult.cylinder) : 1;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Beaker className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold">Cup Tipover Physics Analyzer</h1>
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
        {!splatBuffer ? (
          // Upload state
          <div className="max-w-xl mx-auto mt-20">
            <FileUpload onFileLoaded={handleFileLoaded} isLoading={isLoading} />
            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-2">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Upload a gaussian splat (.splat) file of a cup</li>
                    <li>The app automatically detects the cup's interior volume</li>
                    <li>Adjust fill level and tilt angle to see physics simulation</li>
                    <li>View tipover angle and stability status in real-time</li>
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
                <SplatViewer
                  splatBuffer={splatBuffer}
                  cylinder={volumeResult?.cylinder || null}
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
            <div className="space-y-6">
              {/* File Upload */}
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-3">Splat File</h2>
                <FileUpload onFileLoaded={handleFileLoaded} isLoading={isLoading} />
              </div>

              {/* Physics Controls */}
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-4">Physics Controls</h2>
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
              {volumeResult && (
                <div className="bg-gray-900 rounded-xl p-4">
                  <h2 className="text-sm font-medium text-gray-400 mb-3">Detection Info</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Orientation</span>
                      <span className="text-gray-300 capitalize">{volumeResult.orientation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cylinder Radius</span>
                      <span className="text-gray-300">
                        {(volumeResult.cylinder.radius * unitScale * 100).toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cylinder Height</span>
                      <span className="text-gray-300">
                        {(volumeResult.cylinder.height * unitScale * 100).toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence</span>
                      <span className="text-gray-300">
                        {(volumeResult.cylinder.confidence * 100).toFixed(0)}%
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
