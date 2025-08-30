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
  const [isInCar, setIsInCar] = useState(false);
  const [carRef, setCarRef] = useState(null);

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
      let targetPosition;
      
      // 자동차에 탑승한 상태인지 확인
      if (characterRef.current?.isInCar && characterRef.current?.carRef) {
        targetPosition = characterRef.current.carRef.current.position;
      } else {
        targetPosition = characterRef.current.position;
      }
      
      // 타겟 위치에 고정된 오프셋을 더해서 카메라 위치 계산
      const targetCameraPosition = targetPosition.clone().add(cameraOffset);
      
      // 부드러운 카메라 이동 (X, Z만 따라가고 Y는 고정)
      camera.position.lerp(targetCameraPosition, delta * 5.0);
      
      // 타겟을 바라보도록 설정
      camera.lookAt(targetPosition);
    }
  });

  return null;
}

function Model({ characterRef, gameState, setGameState }) {
  const { scene, animations } = useGLTF('/resources/Ultimate Animated Character Pack - Nov 2019/glTF/Worker_Male.gltf');
  const { actions } = useAnimations(animations, characterRef);
  
  const { forward, backward, left, right, shift, e } = useKeyboardControls();
  const [currentAnimation, setCurrentAnimation] = useState('none');
  const [isInCar, setIsInCar] = useState(false);
  const [carRef, setCarRef] = useState(null);
  const [carOriginalPosition] = useState(new THREE.Vector3(0, 0, 0));
  const [carOriginalRotation] = useState(new THREE.Euler(0, Math.PI / 2, 0));
  const [isTransitioning, setIsTransitioning] = useState(false); // 상태 전환 중 플래그
  const [frontWheelAngle, setFrontWheelAngle] = useState(0); // 앞바퀴 조향 각도
  
  // 안전한 참조를 위한 useRef
  const safeCharacterRef = useRef();
  const safeCarRef = useRef();

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
      
      // Model 컴포넌트의 handleSetCarRef 함수를 characterRef에 설정
      characterRef.current.modelHandleSetCarRef = handleSetCarRef;
      console.log('modelHandleSetCarRef 설정 완료');
    }
  }, [gameState, characterRef]);

  useEffect(() => {
    let animToPlay = 'Idle';
    if (gameState === 'playing_level1' || gameState === 'playing_level2' || gameState === 'playing_level3') {
      if (!isInCar && (forward || backward || left || right)) {
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
  }, [forward, backward, left, right, shift, actions, currentAnimation, gameState, isInCar]);

  // E키 상태 추적을 위한 useRef
  const lastEKeyState = useRef(false);
  
  // 자동차 탑승/하차 처리 (useFrame에서 처리)
  const handleCarInteraction = () => {
    // E키가 눌렸을 때만 처리 (상태 변화 감지)
    if (e && !lastEKeyState.current) {
      console.log('=== E키 감지 ===');
      console.log('E키:', e);
      console.log('게임상태:', gameState);
      console.log('자동차참조:', characterRef.current?.carRef);
      console.log('탑승상태:', isInCar);
      console.log('상태전환중:', isTransitioning);
      console.log('characterRef.current:', characterRef.current);
      
      if (gameState === 'playing_level2' && (characterRef.current?.carRef || safeCarRef.current)) {
        if (!isInCar && !isTransitioning) {
          // 자동차 탑승
          console.log('자동차 탑승 시도');
          enterCar();
        } else if (isInCar && !isTransitioning) {
          // 자동차 하차
          console.log('자동차 하차 시도');
          exitCar();
        } else {
          console.log('상태 전환 중 - 입력 무시');
        }
      } else {
        console.log('탑승 조건 불만족:');
        console.log('- 게임상태가 playing_level2:', gameState === 'playing_level2');
        console.log('- characterRef.carRef 존재:', !!characterRef.current?.carRef);
        console.log('- safeCarRef 존재:', !!safeCarRef.current);
        console.log('- 상태 전환 중:', isTransitioning);
      }
    }
    
    // E키 상태 업데이트
    lastEKeyState.current = e;
  };

  // carRef 설정 함수
  const handleSetCarRef = (ref) => {
    console.log('=== Model handleSetCarRef 호출 ===');
    console.log('전달받은 ref:', ref);
    console.log('ref.current:', ref?.current);
    console.log('characterRef.current:', characterRef.current);
    
    if (ref && ref.current && characterRef.current) {
      // 안전한 참조에 저장
      safeCharacterRef.current = characterRef.current;
      safeCarRef.current = ref;
      
      // characterRef.current에도 저장
      characterRef.current.carRef = ref;
      console.log('carRef 저장 완료:', characterRef.current.carRef);
      
      // 상태도 업데이트
      setCarRef(ref);
      
      console.log('안전한 참조 설정 완료');
      console.log('safeCharacterRef.current:', safeCharacterRef.current);
      console.log('safeCarRef.current:', safeCarRef.current);
      
      // 저장 확인
      setTimeout(() => {
        console.log('저장 후 지연 확인:');
        console.log('safeCharacterRef.current:', safeCharacterRef.current);
        console.log('safeCarRef.current:', safeCarRef.current);
      }, 100);
    } else {
      console.log('handleSetCarRef 조건 불만족');
      console.log('ref 존재:', !!ref);
      console.log('ref.current 존재:', !!ref?.current);
      console.log('characterRef.current 존재:', !!characterRef.current);
    }
  };

  const enterCar = () => {
    console.log('=== enterCar 함수 시작 ===');
    console.log('safeCharacterRef.current:', safeCharacterRef.current);
    console.log('safeCarRef.current:', safeCarRef.current);
    
    if (!safeCarRef.current || isInCar || isTransitioning) {
      console.log('enterCar 조건 불만족');
      return;
    }
    
    console.log('자동차 탑승 시작');
    
    // 상태 전환 중 플래그 설정
    setIsTransitioning(true);
    
    // 즉시 탑승 상태 설정
    setIsInCar(true);
    
    // 안전한 참조에 상태 저장
    if (safeCharacterRef.current) {
      safeCharacterRef.current.isInCar = true;
      safeCharacterRef.current.carRef = safeCarRef.current;
      console.log('탑승 상태 설정 완료');
      
      // characterRef.current에도 상태 저장
      if (characterRef.current) {
        characterRef.current.isInCar = true;
        characterRef.current.carRef = safeCarRef.current;
        console.log('characterRef 상태 설정 완료');
      }
    }
    
    // 캐릭터를 자동차 중앙으로 이동
    if (safeCharacterRef.current && safeCarRef.current.current) {
      const carPosition = safeCarRef.current.current.position.clone();
      safeCharacterRef.current.position.copy(carPosition);
      console.log('캐릭터 위치 이동 완료');
      
      // 캐릭터 방향을 자동차가 바라보는 방향으로 변경
      safeCharacterRef.current.rotation.y = safeCarRef.current.current.rotation.y;
      console.log('캐릭터 방향 변경 완료');
    }
    
    // 상태 전환 완료
    setIsTransitioning(false);
    console.log('탑승 완료 - 이제 자동차 조작 가능');
    
    console.log('=== enterCar 함수 완료 ===');
  };

  const exitCar = () => {
    console.log('=== exitCar 함수 시작 ===');
    console.log('safeCharacterRef.current:', safeCharacterRef.current);
    console.log('safeCarRef.current:', safeCarRef.current);
    
    if (!safeCarRef.current || !isInCar || isTransitioning) {
      console.log('exitCar 조건 불만족');
      return;
    }
    
    console.log('자동차 하차 시작');
    
    // 상태 전환 중 플래그 설정
    setIsTransitioning(true);
    
    // 즉시 하차 상태 설정
    setIsInCar(false);
    
    // 안전한 참조에 상태 저장
    if (safeCharacterRef.current) {
      safeCharacterRef.current.isInCar = false;
      safeCharacterRef.current.carRef = null;
      console.log('하차 상태 설정 완료');
      
      // characterRef.current에도 상태 제거
      if (characterRef.current) {
        characterRef.current.isInCar = false;
        characterRef.current.carRef = null;
        console.log('characterRef 상태 제거 완료');
      }
    }
    
    // 자동차를 원래 위치로 복원
    if (safeCarRef.current.current) {
      safeCarRef.current.current.position.copy(carOriginalPosition);
      safeCarRef.current.current.rotation.copy(carOriginalRotation);
      console.log('자동차 위치 복원 완료');
    }
    
    // 캐릭터를 자동차 바깥으로 이동
    if (safeCharacterRef.current && safeCarRef.current.current) {
      const exitPosition = safeCarRef.current.current.position.clone().add(
        new THREE.Vector3(3, 0, 0).applyEuler(safeCarRef.current.current.rotation)
      );
      safeCharacterRef.current.position.copy(exitPosition);
      console.log('캐릭터 하차 위치 이동 완료');
    }
    
    // 상태 전환 완료
    setIsTransitioning(false);
    console.log('하차 완료 - 이제 캐릭터 이동 가능');
    
    console.log('=== exitCar 함수 완료 ===');
  };

  useFrame((state, delta) => {
    // 자동차 상호작용 처리
    handleCarInteraction();
    
    // characterRef.current 손실 시 safeCharacterRef.current 사용
    const currentCharacter = characterRef.current || safeCharacterRef.current;
    if (!currentCharacter) return;

    if (gameState === 'entering_portal') {
      const portalCenter = portalPosition.clone();
      currentCharacter.position.lerp(portalCenter, delta * 2.0);
      currentCharacter.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), delta * 2);

      if (currentCharacter.scale.x < 0.05) { 
        if (gameState !== 'switched') {
          setGameState('playing_level2');
        }
      }
      return;
    }
    
    if (gameState === 'entering_portal_level3') {
      const portalCenter = portalLevel3Position.clone();
      currentCharacter.position.lerp(portalCenter, delta * 2.0);
      currentCharacter.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), delta * 2);

      if (currentCharacter.scale.x < 0.05) { 
        if (gameState !== 'switched_level3') {
          setGameState('playing_level3');
        }
      }
      return;
    }

    if (gameState === 'entering_portal_back_to_level1') {
      // Level1로 바로 이동하고 Level2 포탈 앞에 위치
      currentCharacter.position.copy(level2PortalFrontPosition);
      currentCharacter.scale.set(2, 2, 2);
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
      currentCharacter.quaternion.slerp(targetQuaternion, 0.25);
      currentCharacter.position.add(direction.multiplyScalar(speed));
    }

    if (gameState === 'playing_level1') {
      const characterPos = currentCharacter.position.clone();
      
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
      const characterPosLevel3 = currentCharacter.position.clone();
      characterPosLevel3.y = 0;
      portalLevel3Pos.y = 0;
      const distanceToPortalLevel3 = characterPosLevel3.distanceTo(portalLevel3Pos);
      if (distanceToPortalLevel3 < portalLevel3Radius) {
        setGameState('entering_portal_level3');
      }
    }

    if (gameState === 'playing_level2') {
      if (isInCar && safeCarRef.current) {
        // 자동차 이동 로직 (후륜구동 + 전륜조향)
        if (safeCarRef.current.current) {
          const car = safeCarRef.current.current;
          const speed = shift ? 0.3 : 0.15;
          
          // 앞바퀴 조향 (A/D키) - 독립적으로 처리
          if (left) {
            setFrontWheelAngle(prev => Math.min(prev + 0.02, 0.3)); // 좌회전 (최대 0.3)
          } else if (right) {
            setFrontWheelAngle(prev => Math.max(prev - 0.02, -0.3)); // 우회전 (최대 -0.3)
          } else {
            // 중앙으로 복귀
            setFrontWheelAngle(prev => {
              if (Math.abs(prev) < 0.01) return 0;
              return prev > 0 ? prev - 0.01 : prev + 0.01;
            });
          }
          
          // 전진/후진 (후륜구동) - 앞바퀴 조향에 따라 회전
          if (forward || backward) {
            const moveSpeed = forward ? speed : -speed;
            
            // 앞바퀴 조향이 있을 때만 회전
            if (Math.abs(frontWheelAngle) > 0.01) {
              // 조향 각도에 따른 회전 (방향 수정)
              const turnSpeed = frontWheelAngle * moveSpeed * 0.8;
              car.rotation.y += turnSpeed; // 회전 방향 수정
            }
            
            // 차량 이동 (회전된 방향으로)
            car.position.add(car.getWorldDirection(new THREE.Vector3()).multiplyScalar(moveSpeed));
            
            // 바퀴 회전
            if (car.wheels) {
              const wheelSpeed = Math.abs(moveSpeed) * 20;
              
              // 앞바퀴: 회전 + 조향 (z축 고정, y축 조향)
              if (car.frontWheels) {
                car.frontWheels.forEach(wheel => {
                  // 원래 위치로 복원 (z축 고정)
                  wheel.position.z = wheel.originalPosition.z;
                  
                  // 회전 처리
                  wheel.rotation.x = wheel.originalRotation.x - (wheelSpeed * 0.1); // 회전만
                  wheel.rotation.y = wheel.originalRotation.y + frontWheelAngle; // y축 조향
                });
              }
              
              // 뒷바퀴: 회전만
              if (car.rearWheels) {
                car.rearWheels.forEach(wheel => {
                  wheel.rotation.x -= wheelSpeed;
                });
              }
            }
          } else {
            // 정지 시 앞바퀴만 조향 (z축 고정, y축 조향)
            if (car.frontWheels) {
              car.frontWheels.forEach(wheel => {
                // 원래 위치로 복원 (z축 고정)
                wheel.position.z = wheel.originalPosition.z;
                
                // 조향만 처리
                wheel.rotation.y = wheel.originalRotation.y + frontWheelAngle;
              });
            }
          }
        }
      } else if (safeCharacterRef.current) {
        // 일반 캐릭터 이동
        const characterPos = safeCharacterRef.current.position.clone();
        
        // Check Level2 to Level1 portal
        const portalLevel2ToLevel1Pos = portalLevel2ToLevel1Position.clone();
        characterPos.y = 0;
        portalLevel2ToLevel1Pos.y = 0;
        const distanceToPortalLevel2ToLevel1 = characterPos.distanceTo(portalLevel2ToLevel1Pos);
        if (distanceToPortalLevel2ToLevel1 < portalLevel2ToLevel1Radius) {
          setGameState('entering_portal_back_to_level1');
        }
      }
    }


  });

  return (
    <>
      {!isInCar && (
    <primitive 
      ref={characterRef} 
      object={scene} 
      scale={2} 
      castShadow 
      receiveShadow 
    />
      )}
    </>
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

// RaceFuture 컴포넌트 추가
function RaceFuture({ onCarRef, characterRef, ...props }) {
  const { scene } = useGLTF('/resources/kenney_car-kit/Models/GLB-format/race-future.glb');
  const carRef = useRef();
  
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    // 바퀴 참조 저장 (앞바퀴와 뒷바퀴 구분)
    cloned.wheels = [];
    cloned.frontWheels = [];
    cloned.rearWheels = [];
    
    cloned.traverse((child) => {
      if (child.name && child.name.includes('wheel')) {
        cloned.wheels.push(child);
        
        // 앞바퀴와 뒷바퀴 구분
        if (child.name.includes('front')) {
          cloned.frontWheels.push(child);
          // 앞바퀴의 원래 위치와 회전 저장 (z축 고정용)
          child.originalPosition = child.position.clone();
          child.originalRotation = child.rotation.clone();
        } else if (child.name.includes('back') || child.name.includes('rear')) {
          cloned.rearWheels.push(child);
        }
      }
    });
    
    console.log('바퀴 분류 완료:', {
      total: cloned.wheels.length,
      front: cloned.frontWheels.length,
      rear: cloned.rearWheels.length
    });
    
    return cloned;
  }, [scene]);

  useEffect(() => {
    if (onCarRef && carRef.current && !window.raceFutureInitialized) {
      window.raceFutureInitialized = true; // 전역 플래그로 중복 실행 방지
      console.log('RaceFuture 초기화 시작');
      
      // 즉시 호출하되, characterRef 설정이 완료된 후에만
      const checkAndCall = () => {
        if (characterRef?.current?.handleSetCarRef) {
          console.log('onCarRef 콜백 호출');
          onCarRef(carRef);
        } else {
          console.log('handleSetCarRef 대기 중...');
          setTimeout(checkAndCall, 50);
        }
      };
      checkAndCall();
    }
  }, []); // 의존성 배열을 비워서 한 번만 실행

  // Model 컴포넌트에 carRef 설정 함수 추가
  useEffect(() => {
    if (characterRef?.current && !window.handleSetCarRefSet) {
      window.handleSetCarRefSet = true; // 중복 설정 방지
      console.log('handleSetCarRef 함수 설정');
      
      // Model 컴포넌트의 handleSetCarRef 함수를 직접 호출할 수 있도록 설정
      characterRef.current.handleSetCarRef = (ref) => {
        console.log('RaceFuture handleSetCarRef 콜백 실행:', ref);
        if (ref && ref.current) {
          // 바퀴 참조를 ref에 추가
          ref.current.wheels = clonedScene.wheels;
          ref.current.frontWheels = clonedScene.frontWheels;
          ref.current.rearWheels = clonedScene.rearWheels;
          console.log('바퀴 참조 추가 완료');
          
          // Model 컴포넌트의 handleSetCarRef 함수 직접 호출
          if (characterRef.current.modelHandleSetCarRef) {
            characterRef.current.modelHandleSetCarRef(ref);
          }
        }
      };
      console.log('handleSetCarRef 설정 완료');
    }
  }, [characterRef, clonedScene.wheels]);

  return <primitive ref={carRef} object={clonedScene} {...props} />;
}
useGLTF.preload('/resources/kenney_car-kit/Models/GLB-format/race-future.glb');

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

function Level2({ onCarRef, characterRef }) {
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
      
      {/* RaceFuture 자동차 추가 */}
      <RaceFuture 
        position={[0, 0, 0]} 
        scale={5} 
        rotation={[0, Math.PI / 2, 0]} 
        onCarRef={onCarRef}
        characterRef={characterRef}
      />
      
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
          {gameState === 'playing_level2' ? <Level2 onCarRef={(ref) => {
            console.log('=== App onCarRef 콜백 ===');
            console.log('전달받은 ref:', ref);
            console.log('characterRef.current:', characterRef.current);
            console.log('handleSetCarRef 존재:', !!characterRef.current?.handleSetCarRef);
            
            if (characterRef.current?.handleSetCarRef) {
              console.log('handleSetCarRef 호출');
              characterRef.current.handleSetCarRef(ref);
            } else {
              console.log('handleSetCarRef가 정의되지 않음');
            }
          }} characterRef={characterRef} /> : 
           gameState === 'playing_level3' ? <Level3 /> : <Level1 characterRef={characterRef} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;