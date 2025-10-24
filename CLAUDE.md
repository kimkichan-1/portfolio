# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D interactive portfolio game built with React, Three.js, and React Three Fiber. The project features three distinct levels where users control an animated character to explore projects and interact with various 3D elements including portals, vehicles, and environmental objects.

## Development Commands

### Start Development Server
```bash
npm start
```
Runs the app in development mode on `http://localhost:3000`

### Build Production
```bash
npm run build
```
Creates an optimized production build in the `build/` folder

### Run Tests
```bash
npm test
```
Launches the test runner in interactive watch mode

### Deploy to Netlify
```bash
netlify deploy --prod
```
Deploys the production build to Netlify. The project includes `netlify.toml` configuration file with optimized settings for React SPA deployment.

## Core Architecture

### Game State Management
The application uses a state machine pattern with the following states:
- `playing_level1`: Natural environment with palm trees, NPC, and portals
- `entering_portal`: Transition state when entering Level 2 portal
- `playing_level2`: Urban racing environment with drivable car
- `entering_portal_level3`: Transition state when entering Level 3 portal
- `playing_level3`: Architectural/building environment

### Key System Components

**Character System** (`src/App.js` - `Model` component)
- Uses GLTF animated character from Ultimate Animated Character Pack
- Animations: Idle, Walk, Run controlled by `useAnimations` hook
- Movement speed: ~0.1 units for walking, ~0.2 units for running
- Position tracking via `characterRef` shared across components
- Audio integration: footstep sounds synchronized with walk/run animations

**Vehicle System** (Level 2 only - `RaceFuture` component)
- Front-wheel steering with rear-wheel drive physics
- Enter/exit vehicle with 'E' key
- Realistic wheel animations (front wheels steer, all wheels rotate)
- Speed system: gradual acceleration/deceleration with max speed ~0.3 units
- Steering angle: max ±0.5 radians
- Character becomes invisible when in car, reappears on exit

**Camera System** (`CameraController` component)
- Fixed offset camera following character/vehicle: `(-0.00, 28.35, 19.76)`
- Smooth lerp-based tracking (delta * 5.0 for normal, delta * 2.0 for portal transitions)
- Special behavior during portal transitions: closer follow with lookAt character
- Camera automatically tracks vehicle when character is in car

**Portal System** (`PortalVortex.js`)
- Custom GLSL shader-based portal visuals with swirling vortex effect
- Two portal variants: blue-white for Level 2, white-orange for Level 3
- Collision detection via distance checking (portalRadius = 2 units)
- Portal positions defined as constants at top of App.js (e.g., `portalPosition`, `portalLevel3Position`)

### Input Handling

Keyboard controls via `useKeyboardControls.js`:
- WASD: Character movement
- Shift: Sprint modifier
- E: Car interaction (Level 2)
- C: Camera debug logging
- Enter: UI interactions

## Custom Shaders

**GradientFloorMaterial** (`src/App.js`)
- Vertex shader passes world position and screen position to fragment shader
- Fragment shader creates diagonal gradient from screen coordinates
- Includes Three.js shadow mapping support (`#include <shadowmap_pars_fragment>`)
- Colors: `#90EE90` (start) to `#E0FFE0` (end) for Level 1

**VortexMaterial** (`src/PortalVortex.js`)
- Time-based animation via `uTime` uniform updated in `useFrame`
- Polar coordinate transformation for swirl effect
- Noise-based pattern generation
- Transparency with intensity fade toward center

## 3D Asset Organization

Assets are located in `public/` directory:
- **Characters**: `resources/Ultimate Animated Character Pack/glTF/Worker_Male.gltf`
- **Vehicles**: `resources/kenney_car-kit/Models/GLB-format/race-future.glb`
- **Nature**: `resources/Nature-Kit/Models/GLTF-format/` (stones, paths, etc.)
- **Trees**: `resources/Ultimate Nature Pack/FBX/PalmTree_4.fbx`
- **Custom Models**: Portal bases, game maps, decorative elements (githubcat.glb, mailbox.glb, toolbox.glb, etc.)
- **Audio**: `sounds/` (footsteps, car sounds)

Models use `useGLTF.preload()` or `useFBX()` for loading. All meshes should have `castShadow` and `receiveShadow` enabled via `traverse()`.

## Level Structure

Each level is a separate component that receives `characterRef`:

**Level1** (`src/App.js` line ~1855)
- Green gradient floor with natural theme
- NPC character with speech bubble
- Two portals: one to Level 2 (blue), one to Level 3 (orange)
- Palm trees and stone decorations
- Social media objects (GitHub cat, Instagram logo, mailbox)

**Level2** (`src/App.js` line ~1994)
- Urban/racing theme
- Drivable car (`RaceFuture` component)
- Return portal to Level 1
- Vehicle physics and interaction system

**Level3** (`src/App.js` line ~2072)
- Architectural environment
- Game map models (`GameMap.glb`, `GameMap2.glb`)
- Return portal to Level 1
- Complex building structures

## Component Patterns

**Model Cloning**
Most 3D models are cloned using `useMemo()` to allow multiple independent instances:
```javascript
const clonedScene = useMemo(() => {
  const cloned = scene.clone();
  cloned.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return cloned;
}, [scene]);
```

**Portal Collision Detection**
Distance-based checking in `useFrame`:
```javascript
const distance = characterRef.current.position.distanceTo(portalPosition);
if (distance < portalRadius) {
  // Trigger portal transition
}
```

**Animation State Management**
Animations use fade in/out transitions (0.5s duration) when switching states.

## Important Constants and Positions

Portal positions and radii are defined at the top of App.js (~line 173):
- `portalPosition`: Level 1 to Level 2 portal
- `portalLevel3Position`: Level 1 to Level 3 portal
- `portalLevel2ToLevel1Position`: Return portal in Level 2
- `portalLevel3ToLevel1Position`: Return portal in Level 3
- Portal radii: 2 units
- Character spawn positions vary by level

Camera offset: `new THREE.Vector3(-0.00, 28.35, 19.76)`

## Shadow System

The game uses Three.js shadow mapping:
- Directional light with shadows enabled
- Shadow map size: typically 2048x2048
- All meshes should have both `castShadow` and `receiveShadow` set to true
- Custom shaders must include shadow mapping shader chunks

## Performance Considerations

- Use `useMemo()` for cloned 3D models to prevent unnecessary re-renders
- Preload GLTF models with `useGLTF.preload()`
- Audio files are preloaded with `preload='auto'`
- Shadow maps are performance-intensive; camera settings optimized for balance

## Common Development Tasks

**Adding a new 3D object:**
1. Place asset file in appropriate `public/resources/` subdirectory
2. Create component using `useGLTF()` or `useFBX()`
3. Clone scene and enable shadows in `useMemo()`
4. Add `useGLTF.preload()` call after component
5. Place component in desired level with position/scale/rotation props

**Adding a new portal:**
1. Define portal position and radius constants
2. Add portal collision detection in `Model` component's `useFrame`
3. Create new game state for transition
4. Add `PortalVortex` visual component at portal location
5. Add `PortalBase` model beneath vortex

**Modifying character movement:**
- Speed values are in `useFrame` within `Model` component (~line 500-700)
- Walking speed: ~0.1, running speed: ~0.2
- Rotation speed: delta * 3.0

**Adding new audio:**
1. Place audio file in `public/sounds/`
2. Create `useRef()` for audio element
3. Load in `useEffect()` with `new Audio(path)`
4. Trigger playback with `.play()` at appropriate event
