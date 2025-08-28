import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';
import { useKeyboardControls } from './useKeyboardControls';
import { PortalVortex } from './PortalVortex';

function CameraLogger() {
  const { log } = useKeyboardControls();
  const { camera } = useThree();
  const logRef = useRef(false);

  useEffect(() => {
    // Log only when 'c' is pressed (rising edge)
    if (log && !logRef.current) {
      const pos = camera.position.toArray().map(p => p.toFixed(2));
      const rot = camera.rotation.toArray().slice(0, 3).map(r => r.toFixed(2)); // Fixed: slice to get only numbers
      console.log(`Camera Position: [${pos.join(', ')}]`);
      console.log(`Camera Rotation: [${rot.join(', ')}]`);
    }
    logRef.current = log;
  }, [log, camera]);

  return null;
}



const portalPosition = new THREE.Vector3(-20, 5, -20);
const portalRadius = 2;
const initialCameraPosition = new THREE.Vector3(0.13, 29.52, 27.60);

function CameraController({ gameState, characterRef }) {
  const { camera } = useThree();

  useEffect(() => {
    if (gameState === 'playing_level2') {
      camera.position.copy(initialCameraPosition);
      camera.rotation.set(-0.89, 0.00, 0.00);
    }
  }, [gameState, camera]);

  useFrame((state, delta) => {
    if (gameState === 'entering_portal' && characterRef.current) {
      const characterPosition = characterRef.current.position;
      const targetPosition = characterPosition.clone().add(new THREE.Vector3(0, 3, 5));
      camera.position.lerp(targetPosition, delta * 2.0);
      camera.lookAt(characterPosition);
    }
  });

  return null;
}

function Model({ characterRef, gameState, setGameState }) {
  const { scene, animations } = useGLTF('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/BaseCharacter.gltf');
  const { actions } = useAnimations(animations, characterRef);
  
  const { forward, backward, left, right, shift } = useKeyboardControls();
  const [currentAnimation, setCurrentAnimation] = useState('none');

  useEffect(() => {
    if (gameState === 'playing_level2') {
      characterRef.current.position.set(0, 0, 10);
      characterRef.current.scale.set(2, 2, 2);
    }
  }, [gameState, characterRef]);

  useEffect(() => {
    let animToPlay = 'Idle';
    if (gameState === 'playing_level1' || gameState === 'playing_level2') {
      if (forward || backward || left || right) {
        animToPlay = shift ? 'Run' : 'Walk';
      }
    } 

    if (currentAnimation !== animToPlay) {
      const oldAction = actions[currentAnimation];
      const newAction = actions[animToPlay];
      
      if (oldAction) oldAction.fadeOut(0.5);
      if (newAction) newAction.reset().fadeIn(0.5).play();

      setCurrentAnimation(animToPlay);
    }
  }, [forward, backward, left, right, shift, actions, currentAnimation, gameState]);

  useFrame((state, delta) => {
    if (!characterRef.current) return;

    if (gameState === 'entering_portal') {
      const portalCenter = portalPosition.clone();
      characterRef.current.position.lerp(portalCenter, delta * 2.0);
      characterRef.current.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), delta * 2);

      if (characterRef.current.scale.x < 0.05) { 
        if (gameState !== 'switched') {
          setGameState('playing_level2');
        }
      }
      return;
    }
    
    const isPlaying = gameState === 'playing_level1' || gameState === 'playing_level2';
    if (!isPlaying) return;

    const speed = shift ? 0.3 : 0.1;
    const direction = new THREE.Vector3();
    
    if (forward) direction.z -= 1;
    if (backward) direction.z += 1;
    if (left) direction.x -= 1;
    if (right) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();
      const targetAngle = Math.atan2(direction.x, direction.z);
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
      characterRef.current.quaternion.slerp(targetQuaternion, 0.25);
      characterRef.current.position.add(direction.multiplyScalar(speed));
    }

    if (gameState === 'playing_level1') {
      const characterPos = characterRef.current.position.clone();
      const portalPos = portalPosition.clone();
      characterPos.y = 0;
      portalPos.y = 0;
      const distanceToPortal = characterPos.distanceTo(portalPos);
      if (distanceToPortal < portalRadius) {
        setGameState('entering_portal');
      }
    }
  });

  return <primitive ref={characterRef} object={scene} scale={2} />;
}

useGLTF.preload('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/BaseCharacter.gltf');

function PortalBase(props) {
  const { scene } = useGLTF('/portalbase.glb');
  return <primitive object={scene} {...props} />;
}

useGLTF.preload('/portalbase.glb');

function Level1() {
  const floorTexture = useTexture('/resources/level1map.png');
  
  return (
    <>
      <PortalBase position={portalPosition} scale={15} />
      <PortalVortex position={[-19.7, 5.5, -21]} scale={[5, 7, 1]} />
      {/* Floor with level1map.png texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial map={floorTexture} />
      </mesh>
    </>
  );
}

function Level2() {
  return (
    <>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
      <gridHelper args={[100, 100]} position={[0, -5, 0]} />
    </>
  );
}

function App() {
  const [gameState, setGameState] = useState('playing_level1'); // playing_level1, entering_portal, playing_level2
  const characterRef = useRef();

  return (
    <div className="App">
      <Canvas camera={{ position: initialCameraPosition, rotation: [-0.89, 0.00, 0.00] }}>
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <Suspense fallback={null}>
          <Model characterRef={characterRef} gameState={gameState} setGameState={setGameState} />
          <CameraController gameState={gameState} characterRef={characterRef} />
          <CameraLogger />
          {gameState === 'playing_level2' ? <Level2 /> : <Level1 />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;