import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, shaderMaterial, useFBX, Text } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import './App.css';
import { useKeyboardControls } from './useKeyboardControls';
import { PortalVortex, PortalVortexLevel3 } from './PortalVortex';

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



const portalPosition = new THREE.Vector3(-20, 7.5, -20);
const portalRadius = 2;
const portalLevel3Position = new THREE.Vector3(20, 7.5, -20);
const portalLevel3Radius = 2;
const portalLevel2ToLevel1Position = new THREE.Vector3(0, 7.5, 23.5);
const portalLevel2ToLevel1Radius = 2;
const level2PortalFrontPosition = new THREE.Vector3(-20, 0, -15); // Level2 포탈 앞 위치
const initialCameraPosition = new THREE.Vector3(0, 15, 15);

function CameraController({ gameState, characterRef }) {
  const { camera } = useThree();
  const cameraOffset = new THREE.Vector3(-0.00, 28.35, 19.76); // 고정된 카메라 오프셋

  useFrame((state, delta) => {
    if (!characterRef.current) return;

    if (gameState === 'entering_portal' || gameState === 'entering_portal_level3') {
      const characterPosition = characterRef.current.position;
      const targetPosition = characterPosition.clone().add(new THREE.Vector3(0, 3, 5));
      camera.position.lerp(targetPosition, delta * 2.0);
      camera.lookAt(characterPosition);
      return;
    }



    if (gameState === 'playing_level1' || gameState === 'playing_level2' || gameState === 'playing_level3') {
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
  const { scene, animations } = useGLTF('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/Worker_Male.gltf');
  const { actions } = useAnimations(animations, characterRef);
  
  const { forward, backward, left, right, shift } = useKeyboardControls();
  const [currentAnimation, setCurrentAnimation] = useState('none');

  useEffect(() => {
    if (gameState === 'playing_level2') {
      characterRef.current.position.set(0, 0, 10);
      characterRef.current.scale.set(2, 2, 2);
    }
    
    if (gameState === 'playing_level3') {
      characterRef.current.position.set(0, 0, 15);
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
    if (gameState === 'playing_level1' || gameState === 'playing_level2' || gameState === 'playing_level3') {
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
    
    if (gameState === 'entering_portal_level3') {
      const portalCenter = portalLevel3Position.clone();
      characterRef.current.position.lerp(portalCenter, delta * 2.0);
      characterRef.current.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), delta * 2);

      if (characterRef.current.scale.x < 0.05) { 
        if (gameState !== 'switched_level3') {
          setGameState('playing_level3');
        }
      }
      return;
    }

    if (gameState === 'entering_portal_back_to_level1') {
      // Level1로 바로 이동하고 Level2 포탈 앞에 위치
      characterRef.current.position.copy(level2PortalFrontPosition);
      characterRef.current.scale.set(2, 2, 2);
      setGameState('playing_level1');
      return;
    }
    
    const isPlaying = gameState === 'playing_level1' || gameState === 'playing_level2' || gameState === 'playing_level3';
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
      
      // Check Level2 portal
      const portalPos = portalPosition.clone();
      characterPos.y = 0;
      portalPos.y = 0;
      const distanceToPortal = characterPos.distanceTo(portalPos);
      if (distanceToPortal < portalRadius) {
        setGameState('entering_portal');
        return;
      }
      
      // Check Level3 portal
      const portalLevel3Pos = portalLevel3Position.clone();
      const characterPosLevel3 = characterRef.current.position.clone();
      characterPosLevel3.y = 0;
      portalLevel3Pos.y = 0;
      const distanceToPortalLevel3 = characterPosLevel3.distanceTo(portalLevel3Pos);
      if (distanceToPortalLevel3 < portalLevel3Radius) {
        setGameState('entering_portal_level3');
      }
    }

    if (gameState === 'playing_level2') {
      const characterPos = characterRef.current.position.clone();
      
      // Check Level2 to Level1 portal
      const portalLevel2ToLevel1Pos = portalLevel2ToLevel1Position.clone();
      characterPos.y = 0;
      portalLevel2ToLevel1Pos.y = 0;
      const distanceToPortalLevel2ToLevel1 = characterPos.distanceTo(portalLevel2ToLevel1Pos);
      if (distanceToPortalLevel2ToLevel1 < portalLevel2ToLevel1Radius) {
        setGameState('entering_portal_back_to_level1');
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

useGLTF.preload('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/Casual_Male.gltf');

function SpeechBubble({ position, text, ...props }) {
  const meshRef = useRef();
  const { camera } = useThree();
  const [isVisible, setIsVisible] = useState(false);

  // 텍스트 로딩을 위한 딜레이 - 프리로드된 텍스트가 있으므로 더 빠르게
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
  });

  return (
    <group ref={meshRef} position={position} {...props}>
      {/* 말풍선 테두리 */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[4.2, 1.7]} />
        <meshBasicMaterial color="black" transparent opacity={0.8} />
      </mesh>
      {/* 말풍선 배경 */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[4, 1.5]} />
        <meshBasicMaterial color="white" transparent opacity={0.95} />
      </mesh>
      {/* 텍스트 - 짧은 딜레이 후 표시 */}
      {isVisible && (
        <Suspense fallback={null}>
          <Text
            position={[0, 0, 0.02]}
            fontSize={0.4}
            color="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.5}
            textAlign="center"
          >
            {text}
          </Text>
        </Suspense>
      )}
    </group>
  );
}

function NPCCharacter({ position, playerRef, ...props }) {
  const npcRef = useRef();
  const { scene, animations } = useGLTF('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/Casual_Male.gltf');
  const { actions } = useAnimations(animations, npcRef);
  
  const [isPlayerNear, setIsPlayerNear] = useState(false);
  const { camera } = useThree();
  const initialRotationY = useRef(0); // 초기 Y 회전각 저장

  // NPC 모델을 복사해서 독립적으로 작동하도록 함
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

  // 현재 애니메이션 상태 추적
  const [currentAnim, setCurrentAnim] = useState(null);

  // 통합된 useFrame - 위치, 애니메이션, 거리 체크
  useFrame(() => {
    if (!npcRef.current) return;

    // 1. NPC 위치 강제 설정
    const currentPos = npcRef.current.position;
    const targetPos = new THREE.Vector3(...position);
    
    if (currentPos.distanceTo(targetPos) > 0.1) {
      npcRef.current.position.copy(targetPos);
    }

    // 1.1. 초기 회전각 설정 및 저장 (첫 번째 프레임에서만)
    if (initialRotationY.current === 0) {
      const initialAngle = Math.PI / 4; // 45도 (π/4 라디안)
      npcRef.current.rotation.y = initialAngle;
      initialRotationY.current = initialAngle;
    }

    // 1.5. NPC 회전 로직
    if (playerRef.current) {
      const currentAngle = npcRef.current.rotation.y;
      let targetAngle;

      if (isPlayerNear) {
        // 플레이어가 가까이 있을 때: 플레이어를 바라봄
        const npcPos = npcRef.current.position;
        const playerPos = playerRef.current.position;
        
        // Y축만 회전하도록 설정 (좌우 회전만)
        const direction = new THREE.Vector3();
        direction.subVectors(playerPos, npcPos);
        direction.y = 0; // Y축 성분 제거 (위아래 회전 방지)
        direction.normalize();
        
        targetAngle = Math.atan2(direction.x, direction.z);
      } else {
        // 플레이어가 멀리 있을 때: 원래 각도로 돌아감
        targetAngle = initialRotationY.current;
      }
      
      // 각도 차이 계산 (최단 경로로 회전)
      let angleDiff = targetAngle - currentAngle;
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // 부드러운 회전 (lerp)
      npcRef.current.rotation.y += angleDiff * 0.1;
    }

    // 2. 플레이어와의 거리 체크
    if (playerRef.current) {
      const npcPos = npcRef.current.position;
      const playerPos = playerRef.current.position;
      const distance = npcPos.distanceTo(playerPos);
      
      const nearDistance = 8;
      const wasNear = isPlayerNear;
      const nowNear = distance < nearDistance;
      
      if (wasNear !== nowNear) {
        setIsPlayerNear(nowNear);
      }
    }

    // 3. 애니메이션 관리
    if (actions && Object.keys(actions).length > 0) {
      const targetAnim = isPlayerNear ? 'Victory' : 'Idle';
      
      if (currentAnim !== targetAnim && actions[targetAnim]) {
        // 이전 애니메이션 정지
        if (currentAnim && actions[currentAnim]) {
          actions[currentAnim].stop();
        }
        
        // 새 애니메이션 시작
        actions[targetAnim].reset().setLoop(THREE.LoopRepeat).play();
        setCurrentAnim(targetAnim);
      }
    }
  });

  return (
    <>
      <primitive 
        ref={npcRef} 
        object={scene} 
        scale={2} 
        castShadow 
        receiveShadow 
        {...props}
      />
      {/* 말풍선 */}
      {isPlayerNear && (
        <SpeechBubble position={[position[0], position[1] + 8.5, position[2]]} text="첫번쨰 프로젝트에 오신걸 환영합니다! 🎉" />
      )}
    </>
  );
}

function PortalBase(props) {
  const { scene } = useGLTF('/portalbase.glb');
  
  // 포털베이스 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
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
  
  return <primitive object={clonedScene} {...props} />;
}

useGLTF.preload('/portalbase.glb');

function PathStone(props) {
  const { scene } = useGLTF('/resources/Nature-Kit/Models/GLTF-format/path_stone.glb');
  
  // 패스스톤의 모든 메시에 그림자 속성 추가
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

useGLTF.preload('/resources/Nature-Kit/Models/GLTF-format/path_stone.glb');

function SmallStoneFlatA(props) {
  const { scene } = useGLTF('/resources/Nature-Kit/Models/GLTF-format/stone_smallFlatA.glb');
  
  // 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
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
  
  return <primitive object={clonedScene} {...props} />;
}

useGLTF.preload('/resources/Nature-Kit/Models/GLTF-format/stone_smallFlatA.glb');

function PalmTree(props) {
  const fbx = useFBX('/resources/Ultimate Nature Pack - Jun 2019/FBX/PalmTree_4.fbx');
  
  // 팜트리 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
  const clonedTree = useMemo(() => {
    const cloned = fbx.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [fbx]);
  
  return <primitive object={clonedTree} {...props} />;
}

// FBX 파일은 preload 방식이 다름
// useFBX.preload('/resources/Ultimate Nature Pack - Jun 2019/FBX/PalmTree_1.fbx');

function Level1({ characterRef }) {
  // 돌들의 위치와 속성을 배열로 정의
  const stones = [
    { position: [-17, 0.1, -7], scale: 8, rotation: [0, 0, 0] },
    { position: [-22, 0.3, -2], scale: 8, rotation: [0, 0.5, 0] },
    { position: [-16, 0.25, 2], scale: 8, rotation: [0, -0.3, 0] },
    { position: [-22, 0.2, 6], scale: 8, rotation: [0, 0.2, 0] },
    { position: [-16, 0.2, 10], scale: 8, rotation: [0, -0.2, 0] },
    { position: [-22, 0.15, 14], scale: 8, rotation: [0, 0.1, 0] },

    { position: [23, 0.1, -7], scale: 8, rotation: [0, 0, 0] },
    { position: [18, 0.1, -2], scale: 8, rotation: [0, 0.5, 0] },
    { position: [24, 0.15, 2], scale: 8, rotation: [0, -0.3, 0] },
    { position: [18, 0.1, 6], scale: 8, rotation: [0, 0.2, 0] },
    { position: [24, 0.1, 10], scale: 8, rotation: [0, -0.2, 0] },
    { position: [18, 0.1, 14], scale: 8, rotation: [0, 0.1, 0] },
  ];

  // 팜트리들의 위치와 속성을 배열로 정의
  const palmTrees = [
    { position: [-30, 0, -10], scale: 0.05, rotation: [0, 0, 0] },
    { position: [30, 0, -10], scale: 0.05, rotation: [0, 0, 0] },
  ];

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
      <PortalVortex position={[-19.7, 8, -22]} scale={[7, 9.8, 1]} />
      
      {/* Level3 Portal */}
      <PortalBase position={portalLevel3Position} scale={20} />
      <PortalVortexLevel3 position={[20.3, 8, -22]} scale={[7, 9.8, 1]} />
      
      {/* Path stones leading to the portal */}
      <PathStone position={[-22, 0.2, -13]} scale={7} rotation={[0, -0.2, 0]} />
      
      {/* Small stones scattered around the level */}
      {stones.map((stone, index) => (
        <SmallStoneFlatA 
          key={index} 
          position={stone.position} 
          scale={stone.scale} 
          rotation={stone.rotation} 
        />
      ))}

      {/* Palm trees scattered around the level */}
      {palmTrees.map((tree, index) => (
        <PalmTree 
          key={index} 
          position={tree.position} 
          scale={tree.scale} 
          rotation={tree.rotation} 
        />
      ))}

      {/* NPC Character */}
      <NPCCharacter position={[-27, 0, -8]} playerRef={characterRef} />
      
      {/* 숨겨진 텍스트로 프리로드 - 화면 밖에 배치 */}
      <Text
        position={[1000, 1000, 1000]}
        fontSize={0.4}
        color="black"
        visible={false}
      >
        첫번쨰 프로젝트에 오신걸 환영합니다! 🎉
      </Text>
      
      {/* Floor with gradient green color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={gradientTexture} />
      </mesh>
    </>
  );
}

function Level2() {
  // level2map.png 텍스처 로드
  const level2Texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load('/resources/level2map.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }, []);

  return (
    <>
      <Sky />
      
      {/* Level1으로 돌아가는 포탈 - 캐릭터 뒤쪽에 배치 */}
      <PortalBase position={[0, 7.5, 23.5]} scale={20} />
      <PortalVortex position={[0.3, 8, 22]} scale={[7, 9.8, 1]} />
      
      {/* Floor with level2map.png texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={level2Texture} />
      </mesh>
    </>
  );
}

function Level3() {
  return (
    <>
      <Sky />
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 8, 8]} />
        <meshStandardMaterial color="#FF8C00" />
      </mesh>
      <mesh position={[10, 3, 5]} castShadow receiveShadow>
        <sphereGeometry args={[3, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#FFE4B5" />
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
          {gameState === 'playing_level2' ? <Level2 /> : 
           gameState === 'playing_level3' ? <Level3 /> : <Level1 characterRef={characterRef} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;