import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';
import { useKeyboardControls } from './useKeyboardControls';

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

function Model(props) {
  const group = useRef();
  const { scene, animations } = useGLTF('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/BaseCharacter.gltf');
  const { actions } = useAnimations(animations, group);
  
  const { forward, backward, left, right, shift } = useKeyboardControls();
  const [currentAnimation, setCurrentAnimation] = useState('none');

  // Animation management
  useEffect(() => {
    let newAnimation = 'Idle';
    if (forward || backward || left || right) {
      newAnimation = shift ? 'Run' : 'Walk';
    }

    if (currentAnimation !== newAnimation) {
      const oldAction = actions[currentAnimation];
      const newAction = actions[newAnimation];
      
      if (oldAction) oldAction.fadeOut(0.5);
      if (newAction) newAction.reset().fadeIn(0.5).play();

      setCurrentAnimation(newAnimation);
    }
  }, [forward, backward, left, right, shift, actions, currentAnimation]);


  // Movement and rotation logic
  useFrame(() => {
    if (!group.current) return;
    
    const speed = shift ? 0.3 : 0.1;
    const direction = new THREE.Vector3();
    
    // Calculate direction based on key presses
    if (forward) direction.z -= 1;
    if (backward) direction.z += 1;
    if (left) direction.x -= 1;
    if (right) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();
      
      // Rotate character to face movement direction
      const targetAngle = Math.atan2(direction.x, direction.z);
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
      group.current.quaternion.slerp(targetQuaternion, 0.25);

      // Move character
      group.current.position.add(direction.multiplyScalar(speed));
    }
  });

  return <primitive ref={group} object={scene} {...props} scale={2} />;
}

useGLTF.preload('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/BaseCharacter.gltf');

function PortalBase(props) {
  const { scene } = useGLTF('/portalbase.glb');
  return <primitive object={scene} {...props} />;
}

useGLTF.preload('/portalbase.glb');

function App() {
  return (
    <div className="App">
      <Canvas camera={{ position: [0.13, 29.52, 27.60], rotation: [-0.89, 0.00, 0.00] }}>
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <Suspense fallback={null}>
          <Model />
          <PortalBase position={[0, 5, -10]} scale={15} />
        </Suspense>
        <gridHelper args={[100, 100]} />
        <CameraLogger />
      </Canvas>
    </div>
  );
}

export default App;