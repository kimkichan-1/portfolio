import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import './App.css';
import { useKeyboardControls } from './useKeyboardControls';
import { PortalVortex } from './PortalVortex';

// 그라데이션 바닥을 위한 셰이더 머티리얼 (그림자 지원)
const GradientFloorMaterial = shaderMaterial(
  // Uniforms
  {
    uColorStart: new THREE.Color('#90EE90'), // 연두색 시작
    uColorEnd: new THREE.Color('#E0FFE0'),   // 훨씬 더 밝은 연두색 끝
  },
  // Vertex Shader
  `
  #include <common>
  #include <shadowmap_pars_vertex>
  
  varying vec4 vScreenPosition;
  varying vec3 vWorldPosition;
  
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    
    // 스크린 좌표를 varying으로 전달
    vScreenPosition = gl_Position;
    
    #include <shadowmap_vertex>
  }
  `,
  // Fragment Shader
  `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  
  uniform vec3 uColorStart;
  uniform vec3 uColorEnd;
  varying vec4 vScreenPosition;
  varying vec3 vWorldPosition;

  void main() {
    // 스크린 좌표를 0-1 범위로 정규화
    vec2 screenUV = (vScreenPosition.xy / vScreenPosition.w) * 0.5 + 0.5;
    
    // 화면 기준 오른쪽 아래로 갈수록 밝아지는 그라데이션
    float gradient = (screenUV.x + (1.0 - screenUV.y)) * 0.5;
    vec3 baseColor = mix(uColorStart, uColorEnd, gradient);
    
    // 그림자 계산
    float shadow = getShadow(directionalShadowMap[0], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[0]);
    
    // 그림자를 기본 색상에 적용
    vec3 finalColor = baseColor * (0.3 + 0.7 * shadow);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
  `
);

extend({ GradientFloorMaterial });

// 하늘을 위한 컴포넌트
function Sky() {
  return (
    <mesh>
      <sphereGeometry args={[400, 32, 32]} />
      <meshBasicMaterial color="#87CEFA" side={THREE.BackSide} />
    </mesh>
  );
}

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



const portalPosition = new THREE.Vector3(-20, 8, -20);
const portalRadius = 2;
const initialCameraPosition = new THREE.Vector3(0, 15, 15);

function CameraController({ gameState, characterRef }) {
  const { camera } = useThree();
  const cameraOffset = new THREE.Vector3(-0.00, 28.35, 19.76); // 고정된 카메라 오프셋

  useFrame((state, delta) => {
    if (!characterRef.current) return;

    if (gameState === 'entering_portal') {
      const characterPosition = characterRef.current.position;
      const targetPosition = characterPosition.clone().add(new THREE.Vector3(0, 3, 5));
      camera.position.lerp(targetPosition, delta * 2.0);
      camera.lookAt(characterPosition);
      return;
    }

    if (gameState === 'playing_level1' || gameState === 'playing_level2') {
      const characterPosition = characterRef.current.position;
      
      // 캐릭터 위치에 고정된 오프셋을 더해서 카메라 위치 계산
      const targetCameraPosition = characterPosition.clone().add(cameraOffset);
      
      // 부드러운 카메라 이동 (X, Z만 따라가고 Y는 고정)
      camera.position.lerp(targetCameraPosition, delta * 5.0);
      
      // 캐릭터를 바라보도록 설정
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
    
    // Enable shadows on all meshes in the character model
    if (characterRef.current) {
      characterRef.current.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
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

  return (
    <primitive 
      ref={characterRef} 
      object={scene} 
      scale={2} 
      castShadow 
      receiveShadow 
    />
  );
}

useGLTF.preload('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/BaseCharacter.gltf');

function PortalBase(props) {
  const { scene } = useGLTF('/portalbase.glb');
  
  // 포털베이스의 모든 메시에 그림자 속성 추가
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);
  
  return <primitive object={scene} {...props} />;
}

useGLTF.preload('/portalbase.glb');

function Level1() {
  // 그라데이션 텍스처 생성
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // 대각선 그라데이션 생성 (왼쪽 위에서 오른쪽 아래로)
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#50AA50'); // 훨씬 더 어두운 연두색 시작
    gradient.addColorStop(1, '#E0FFE0'); // 밝은 연두색 끝
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    
    return texture;
  }, []);

  return (
    <>
      <Sky />
      <PortalBase position={portalPosition} scale={20} />
      <PortalVortex position={[-19.7, 8.5, -22]} scale={[7, 9.8, 1]} />
      {/* Floor with gradient green color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={gradientTexture} />
      </mesh>
    </>
  );
}

function Level2() {
  return (
    <>
      <Sky />
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </>
  );
}

function App() {
  const [gameState, setGameState] = useState('playing_level1'); // playing_level1, entering_portal, playing_level2
  const characterRef = useRef();

  return (
    <div className="App">
              <Canvas 
          camera={{ position: [-0.00, 28.35, 19.76], rotation: [-0.96, -0.00, -0.00] }}
          shadows
        >
        <ambientLight intensity={2} />
        <directionalLight 
          position={[50, 50, 25]} 
          intensity={4} 
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-far={200}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-bias={-0.0001}
        />
        {/* Sun visual */}
        <mesh position={[50, 50, 25]}>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#FDB813" />
        </mesh>

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