# Cup Tipover Physics Analyzer

A Next.js web application that analyzes gaussian splat (.splat) files of cups, automatically detects their internal volume, and provides interactive tipover physics visualization.

## Features

- **Splat Viewer**: Upload and render gaussian splat files with orbit controls
- **Automatic Volume Detection**: Parses splat point positions, detects cup rim via point density analysis, and fits a cylinder to the interior
- **Tipover Physics**: Interactive simulation with fill level and tilt angle controls
- **Real-time Visualization**: Shows liquid level, center of mass, and stability status

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/rahulkalakuntla/cup-tipover-physics.git
cd cup-tipover-physics

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload a Splat File**: Drag and drop a `.splat` file of a cup onto the upload area
2. **View Detection**: The app automatically detects the cup interior and displays a cylinder overlay
3. **Adjust Fill Level**: Use the slider to set how full the cup is (0-100%)
4. **Adjust Tilt Angle**: Use the slider to tilt the cup (0-90°)
5. **View Physics**: See real-time updates of:
   - Center of mass position
   - Critical tipover angle
   - Stability status and margin

## Technical Details

### Splat File Format

The app parses the standard `.splat` binary format:
- 32 bytes per gaussian
- Position: 3x float32 (12 bytes)
- Scale: 3x float32 (12 bytes)
- Color: 4x uint8 RGBA (4 bytes)
- Rotation: 4x uint8 quaternion (4 bytes)

### Volume Detection Algorithm

1. **PCA Analysis**: Detect cup orientation using principal component analysis
2. **Rim Detection**: Find the cup opening by analyzing point density at different heights
3. **Circle Fitting**: Use RANSAC to fit a circle to the rim points
4. **Cylinder Estimation**: Project interior volume as a cylinder from base to rim

### Physics Calculations

- **Center of Mass**: Weighted average of cup centroid and liquid centroid
- **Tipover Angle**: Calculated when CoM passes over base edge: `atan2(radius - horizontal_offset, height)`
- **Liquid Spill**: Geometric calculation of volume above rim when tilted

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **3D Rendering**: Three.js
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Project Structure

```
cup-tipover-physics/
├── app/
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main page component
│   └── globals.css       # Global styles
├── components/
│   ├── SplatViewer.tsx   # Three.js point cloud renderer
│   ├── FileUpload.tsx    # Drag-and-drop upload
│   ├── PhysicsControls.tsx    # Fill/tilt sliders
│   ├── TipoverIndicator.tsx   # Status display
│   └── VolumeOverlay.tsx      # Cylinder visualization
├── lib/
│   ├── splat-parser.ts        # Parse .splat files
│   ├── volume-detection.ts    # Auto-detect cup interior
│   ├── tipover-physics.ts     # Physics calculations
│   ├── cylinder-fitting.ts    # RANSAC cylinder fit
│   └── utils.ts               # Utility functions
└── public/
    └── (sample splat files)
```

## License

MIT
