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
const portalLevel3ToLevel1Position = new THREE.Vector3(0, 7.5, 23.5);
const portalLevel3ToLevel1Radius = 2;
const level2PortalFrontPosition = new THREE.Vector3(-20, 0, -15); // Level2 포탈 앞 위치
const level3PortalFrontPosition = new THREE.Vector3(20, 0, -15); // Level3 포탈 앞 위치
const initialCameraPosition = new THREE.Vector3(0, 15, 15);

function CameraController({ gameState, characterRef }) {
  const { camera } = useThree();
  const cameraOffset = new THREE.Vector3(-0.00, 28.35, 19.76); // 고정된 카메라 오프셋
  
  // 이전 카메라 상태를 추적하기 위한 useRef
  const prevCameraState = useRef({
    isInCar: false,
    targetType: 'character'
  });

  useFrame((state, delta) => {
    if (!characterRef.current || !characterRef.current.position) return;

    if (gameState === 'entering_portal' || gameState === 'entering_portal_level3') {
      const characterPosition = characterRef.current.position;
      const targetPosition = characterPosition.clone().add(new THREE.Vector3(0, 3, 5));
      camera.position.lerp(targetPosition, delta * 2.0);
      camera.lookAt(characterPosition);
      return;
    }

    if (gameState === 'playing_level1' || gameState === 'playing_level2' || gameState === 'playing_level3') {
      let targetPosition;
      let currentTargetType = 'character';
      
      // 자동차에 탑승한 상태인지 확인하고 타겟 위치 결정
      if (characterRef.current?.isInCar && 
          characterRef.current?.safeCarRef?.current) {
        // 자동차에 탑승한 경우: 캐릭터 위치 사용 (자동차와 동기화됨)
        targetPosition = characterRef.current.position;
        currentTargetType = 'car';
        
        // 자동차 상태 확인 완료
      } else {
        // 일반 상태: 캐릭터 위치 사용
        targetPosition = characterRef.current.position;
        currentTargetType = 'character';
      }
      
      // 상태 변화 추적
      if (prevCameraState.current.targetType !== currentTargetType) {
        prevCameraState.current.targetType = currentTargetType;
      }
      
      // 타겟 위치에 고정된 오프셋을 더해서 카메라 위치 계산
      const targetCameraPosition = targetPosition.clone().add(cameraOffset);
      
      // 자동차 위치 변화 감지 로그 제거
      
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
  const [currentSpeed, setCurrentSpeed] = useState(0); // 현재 속도
  const [targetSpeed, setTargetSpeed] = useState(0); // 목표 속도
  
  // 발걸음 소리를 위한 오디오 시스템
  const stepAudioRef = useRef(null);
  const lastStepTimeRef = useRef(0);
  const stepIntervalRef = useRef(0.5); // 발걸음 간격 (초)
  
  // 자동차 소리를 위한 오디오 시스템
  const carOpenAudioRef = useRef(null);
  const carCloseAudioRef = useRef(null);
  

  
  // 안전한 참조를 위한 useRef
  const safeCharacterRef = useRef();
  const safeCarRef = useRef();
  
  // 발걸음 소리 로드 및 재생 함수
  useEffect(() => {
    // 발걸음 소리 로드 (여러 경로 시도, .wav 파일 우선)
    const audioPaths = [
      '/resources/Sounds/Step1.wav',
      '/resources/Sounds/step1.wav',
      '/Sounds/Step1.wav',
      '/resources/Sounds/Step1.mp3',
      '/resources/Sounds/step1.mp3',
      '/Sounds/Step1.mp3'
    ];
    
    // 첫 번째 경로로 시도
    stepAudioRef.current = new Audio(audioPaths[0]);
    stepAudioRef.current.volume = 1.0; // 볼륨을 최대로 설정
    stepAudioRef.current.preload = 'auto';
    
    // 오디오 로드 확인
    stepAudioRef.current.addEventListener('canplaythrough', () => {
      // 발걸음 소리 로드 완료
    });
    
    stepAudioRef.current.addEventListener('error', (e) => {
      // 다른 경로 시도
      for (let i = 1; i < audioPaths.length; i++) {
        const newAudio = new Audio(audioPaths[i]);
        newAudio.volume = 1.0;
        newAudio.preload = 'auto';
        
        newAudio.addEventListener('canplaythrough', () => {
          stepAudioRef.current = newAudio;
        });
        
        newAudio.addEventListener('error', () => {
          // 발걸음 소리 로드 실패
        });
      }
    });
  }, []);

  // 자동차 소리 로드 및 재생 함수
  useEffect(() => {
    // 자동차 문 열기 소리 로드
    carOpenAudioRef.current = new Audio('/sounds/opencar.mp3');
    carOpenAudioRef.current.volume = 0.8;
    carOpenAudioRef.current.preload = 'auto';
    
    // 자동차 문 닫기 소리 로드
    carCloseAudioRef.current = new Audio('/sounds/closecar.mp3');
    carCloseAudioRef.current.volume = 0.8;
    carCloseAudioRef.current.preload = 'auto';
    
    // 오디오 로드 확인
    carOpenAudioRef.current.addEventListener('canplaythrough', () => {
      // 자동차 문 열기 소리 로드 완료
    });
    
    carCloseAudioRef.current.addEventListener('canplaythrough', () => {
      // 자동차 문 닫기 소리 로드 완료
    });
    
    carOpenAudioRef.current.addEventListener('error', (e) => {
      console.log('자동차 문 열기 소리 로드 실패:', e);
    });
    
    carCloseAudioRef.current.addEventListener('error', (e) => {
      console.log('자동차 문 닫기 소리 로드 실패:', e);
    });
  }, []);
  
  // 발걸음 소리 재생 함수
  const playStepSound = () => {
    if (stepAudioRef.current) {
      stepAudioRef.current.currentTime = 0; // 처음부터 재생
      stepAudioRef.current.play().catch(e => {
        // 발걸음 소리 재생 실패
      });
    }
  };

  // 자동차 소리 재생 함수들
  const playCarOpenSound = () => {
    if (carOpenAudioRef.current) {
      carOpenAudioRef.current.currentTime = 0; // 처음부터 재생
      carOpenAudioRef.current.play().catch(e => {
        console.log('자동차 문 열기 소리 재생 실패:', e);
      });
    }
  };

  const playCarCloseSound = () => {
    if (carCloseAudioRef.current) {
      carCloseAudioRef.current.currentTime = 0; // 처음부터 재생
      carCloseAudioRef.current.play().catch(e => {
        console.log('자동차 문 닫기 소리 재생 실패:', e);
      });
    }
  };


  
  // CameraController에서 접근할 수 있도록 characterRef에 저장
  useEffect(() => {
    if (characterRef.current && safeCarRef.current) {
      characterRef.current.safeCarRef = safeCarRef;
    }
  }, [characterRef.current, safeCarRef.current]);

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
      
      // 걷기/뛰기 애니메이션 시작 시 발걸음 소리 시작
      if (animToPlay === 'Walk' || animToPlay === 'Run') {
        lastStepTimeRef.current = Date.now();
        stepIntervalRef.current = animToPlay === 'Run' ? 0.45 : 0.6; // 더 빠른 발걸음 간격
      }
    }
  }, [forward, backward, left, right, shift, actions, currentAnimation, gameState, isInCar]);

  // E키 상태 추적을 위한 useRef
  const lastEKeyState = useRef(false);
  
  // 자동차 탑승/하차 처리 (useFrame에서 처리)
  const handleCarInteraction = () => {
    // E키가 눌렸을 때만 처리 (상태 변화 감지)
    if (e && !lastEKeyState.current) {
      if (gameState === 'playing_level2' && (characterRef.current?.carRef || safeCarRef.current)) {
        if (!isInCar && !isTransitioning) {
          // 자동차 탑승
          enterCar();
        } else if (isInCar && !isTransitioning) {
          // 자동차 하차
          exitCar();
        }
      }
    }
    
    // E키 상태 업데이트
    lastEKeyState.current = e;
  };

  // carRef 설정 함수
  const handleSetCarRef = (ref) => {
    if (ref && characterRef.current) {
      // 안전한 참조에 저장 (ref는 이미 자동차 모델 자체)
      safeCharacterRef.current = characterRef.current;
      safeCarRef.current = ref;
      
      // characterRef.current에도 저장
      characterRef.current.carRef = ref;
      
      // 상태도 업데이트
      setCarRef(ref);
      
            // 자동차의 월드 위치 계산
      if (ref.position) {
        const worldPosition = new THREE.Vector3();
        ref.getWorldPosition(worldPosition);
        ref.worldPosition = worldPosition;
      }
    }
  };

  const enterCar = () => {
    if (!safeCarRef.current || isInCar || isTransitioning) {
      return;
    }
    
    // 자동차 문 열기 소리 재생
    playCarOpenSound();
    
    // 상태 전환 중 플래그 설정
    setIsTransitioning(true);
    
    // 즉시 탑승 상태 설정
    setIsInCar(true);
    
    // 안전한 참조에 상태 저장
    if (safeCharacterRef.current) {
      safeCharacterRef.current.isInCar = true;
      safeCharacterRef.current.carRef = safeCarRef.current;
      
      // characterRef.current에도 상태 저장
      if (characterRef.current) {
        characterRef.current.isInCar = true;
        characterRef.current.carRef = safeCarRef.current;
      }
    }
    
    // 캐릭터를 자동차 중앙으로 이동
    if (safeCharacterRef.current && safeCarRef.current) {
      const carPosition = safeCarRef.current.position.clone();
      safeCharacterRef.current.position.copy(carPosition);
      
      // 캐릭터 방향을 자동차가 바라보는 방향으로 변경
      safeCharacterRef.current.rotation.y = safeCarRef.current.rotation.y;
      
      // 캐릭터를 자동차 중앙으로 이동 완료
    }
    
    // 상태 전환 완료
    setIsTransitioning(false);
  };

  const exitCar = () => {
    if (!safeCarRef.current || !isInCar || isTransitioning) {
      return;
    }
    
    // 자동차 문 닫기 소리 재생
    playCarCloseSound();
    
    // 상태 전환 중 플래그 설정
    setIsTransitioning(true);
    
    // 즉시 하차 상태 설정
    setIsInCar(false);
    
    // 안전한 참조에 상태 저장
    if (safeCharacterRef.current) {
      safeCharacterRef.current.isInCar = false;
      safeCharacterRef.current.carRef = null;
      
      // characterRef.current에도 상태 제거
      if (characterRef.current) {
        characterRef.current.isInCar = false;
        characterRef.current.carRef = null;
      }
    }
    
    // 자동차를 원래 위치로 복원
    if (safeCarRef.current) {
      safeCarRef.current.position.copy(carOriginalPosition);
      safeCarRef.current.rotation.copy(carOriginalRotation);
    }
    
    // 캐릭터를 자동차 바깥으로 이동
    if (safeCharacterRef.current && safeCarRef.current) {
      const exitPosition = safeCarRef.current.position.clone().add(
        new THREE.Vector3(3, 0, 0).applyEuler(safeCarRef.current.rotation)
      );
      safeCharacterRef.current.position.copy(exitPosition);
    }
    
    // 상태 전환 완료
    setIsTransitioning(false);
    setCurrentSpeed(0); // 속도 초기화
    setTargetSpeed(0); // 목표 속도 초기화
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

    if (gameState === 'entering_portal_level3_to_level1') {
      // Level1로 바로 이동하고 Level3 포탈 앞에 위치
      currentCharacter.position.copy(level3PortalFrontPosition);
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
      
      // 발걸음 소리 재생
      if (!isInCar && (currentAnimation === 'Walk' || currentAnimation === 'Run')) {
        const currentTime = Date.now();
        if (currentTime - lastStepTimeRef.current > stepIntervalRef.current * 1000) {
          playStepSound();
          lastStepTimeRef.current = currentTime;
        }
      }
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
        // 자동차 이동 로직 (후륜구동 + 전륜조향 + 가속도 시스템)
        if (safeCarRef.current) {
          const car = safeCarRef.current;
          const maxSpeed = shift ? 1.2 : 0.8; // 최대 속도
          
          // 목표 속도 설정
          let newTargetSpeed = 0;
          if (forward) newTargetSpeed = maxSpeed;
          else if (backward) newTargetSpeed = -maxSpeed;
          
          setTargetSpeed(newTargetSpeed);
          
          // 가속도 적용 (부드러운 가속/감속)
          const acceleration = 0.015; // 가속도 (조금 느리게)
          const deceleration = 0.015; // 감속도 (더 빠르게)
          
          if (Math.abs(newTargetSpeed - currentSpeed) > 0.01) {
            if (newTargetSpeed > currentSpeed) {
              // 가속
              setCurrentSpeed(prev => Math.min(prev + acceleration, newTargetSpeed));
            } else if (newTargetSpeed < currentSpeed) {
              // 감속
              setCurrentSpeed(prev => Math.max(prev - deceleration, newTargetSpeed));
            }
          }
          
          // 현재 속도로 이동 계산
          const speed = currentSpeed;
          
          // 앞바퀴 조향 (A/D키) - 독립적으로 처리 (더 빠르게)
          if (left) {
            setFrontWheelAngle(prev => Math.max(prev - 0.02, -0.2)); // 좌회전 (최대 -0.2, 더 빠르게)
          } else if (right) {
            setFrontWheelAngle(prev => Math.min(prev + 0.02, 0.2)); // 우회전 (최대 0.2, 더 빠르게)
          } else {
            // 중앙으로 복귀 (매우 부드럽게)
            setFrontWheelAngle(prev => {
              if (Math.abs(prev) < 0.01) return 0;
              return prev > 0 ? prev - 0.005 : prev + 0.005;
            });
          }
          
          // 전진/후진 (후륜구동) - 앞바퀴 조향에 따라 회전
          if (Math.abs(speed) > 0.01) { // 속도가 있을 때만 이동
            const moveSpeed = speed; // speed는 이미 방향이 포함됨 (양수: 전진, 음수: 후진)
            
            // 앞바퀴 조향이 있을 때만 회전
            if (Math.abs(frontWheelAngle) > 0.01) {
              // 조향 각도에 따른 회전 (매우 부드럽게)
              const turnSpeed = -frontWheelAngle * moveSpeed * 0.2; // 회전 속도 원래대로
              car.rotation.y += turnSpeed; // 회전 방향 수정
            }
            
            // 차량 이동 (회전된 방향으로)
            car.position.add(car.getWorldDirection(new THREE.Vector3()).multiplyScalar(moveSpeed));
            
            // 바퀴 회전
            if (car.wheels) {
              const wheelSpeed = Math.abs(moveSpeed) * 30;
              
              // 앞바퀴: 조향이 없을 때만 회전 + 조향이 있을 때는 조향만
              if (car.frontWheels) {
                car.frontWheels.forEach(wheel => {
                  // 원래 위치로 복원 (z축 고정)
                  wheel.position.z = wheel.originalPosition.z;
                  
                  // 조향이 거의 없을 때만 회전 처리 (계속 굴러가도록)
                  if (Math.abs(frontWheelAngle) < 0.01 && Math.abs(moveSpeed) > 0.01) {
                    wheel.rotation.x -= wheelSpeed; // 누적 회전 (계속 굴러감)
                  } else {
                    wheel.rotation.x = wheel.originalRotation.x; // 조향이 있으면 원래 위치로
                  }
                  
                  // 조향 처리 (항상 적용)
                  wheel.rotation.y = wheel.originalRotation.y - frontWheelAngle; // y축 조향 (방향 수정)
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
            // 정지 시 앞바퀴만 조향 (z축 고정, y축 조향, 회전 없음)
            if (car.frontWheels) {
              car.frontWheels.forEach(wheel => {
                // 원래 위치로 복원 (z축 고정)
                wheel.position.z = wheel.originalPosition.z;
                
                // 회전은 하지 않고 조향만 처리
                wheel.rotation.x = wheel.originalRotation.x; // 회전하지 않음
                wheel.rotation.y = wheel.originalRotation.y - frontWheelAngle; // y축 조향만
              });
            }
          }
          
          // 자동차에 탑승한 상태에서는 항상 캐릭터를 자동차와 동기화
          if (safeCharacterRef.current && isInCar) {
            safeCharacterRef.current.position.copy(car.position);
            safeCharacterRef.current.rotation.y = car.rotation.y;
          }
          
          // CameraController에서 접근할 수 있도록 속도 정보 저장
          if (safeCharacterRef.current) {
            safeCharacterRef.current.currentSpeed = currentSpeed;
            safeCharacterRef.current.isMoving = Math.abs(currentSpeed) > 0.01;
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

    // Level3에서 Level1로 가는 포탈 체크
    if (gameState === 'playing_level3' && currentCharacter) {
      const characterPos = currentCharacter.position.clone();
      const portalLevel3ToLevel1Pos = portalLevel3ToLevel1Position.clone();
      characterPos.y = 0;
      portalLevel3ToLevel1Pos.y = 0;
      const distanceToPortalLevel3ToLevel1 = characterPos.distanceTo(portalLevel3ToLevel1Pos);
      
      if (distanceToPortalLevel3ToLevel1 < portalLevel3ToLevel1Radius) {
        setGameState('entering_portal_level3_to_level1');
      }
    }


  });

  return (
    <>
    <primitive 
      ref={characterRef} 
      object={scene} 
      scale={2} 
      castShadow 
      receiveShadow 
        visible={!isInCar} // 자동차 탑승 시 투명하게
      />
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
    
    // 자동차의 초기 위치 설정
    cloned.position.set(props.position[0], props.position[1], props.position[2]);
    cloned.rotation.set(props.rotation[0], props.rotation[1], props.rotation[2]);
    
    // 바퀴 분류 및 위치 설정 완료
    
    return cloned;
  }, [scene]);

  useEffect(() => {
    if (onCarRef && carRef.current && !window.raceFutureInitialized) {
      window.raceFutureInitialized = true; // 전역 플래그로 중복 실행 방지
      console.log('RaceFuture 초기화 시작');
      
      // 즉시 호출하되, characterRef 설정이 완료된 후에만
      const checkAndCall = () => {
        if (characterRef?.current?.handleSetCarRef) {
          onCarRef(clonedScene);
        } else {
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
      
      // Model 컴포넌트의 handleSetCarRef 함수를 직접 호출할 수 있도록 설정
      characterRef.current.handleSetCarRef = (ref) => {
        if (ref) {
          // 바퀴 참조를 ref에 추가
          ref.wheels = clonedScene.wheels;
          ref.frontWheels = clonedScene.frontWheels;
          ref.rearWheels = clonedScene.rearWheels;
          
          // Model 컴포넌트의 handleSetCarRef 함수 직접 호출
          if (characterRef.current.modelHandleSetCarRef) {
            characterRef.current.modelHandleSetCarRef(ref);
          }
        }
      };
    }
  }, [characterRef, clonedScene.wheels]);

  // 실시간으로 월드 위치 업데이트
  useFrame(() => {
    if (carRef.current) {
      // 월드 위치 계산 및 저장
      const worldPosition = new THREE.Vector3();
      carRef.current.getWorldPosition(worldPosition);
      carRef.current.worldPosition = worldPosition;
    }
  });

  return <primitive ref={carRef} object={clonedScene} {...props} />;
}
useGLTF.preload('/resources/kenney_car-kit/Models/GLB-format/race-future.glb');

// 둥근 모서리를 가진 정육면체 컴포넌트
function RoundedCube({ position, scale, ...props }) {
  const geometry = useMemo(() => {
    // RoundedBoxGeometry를 사용하여 둥근 모서리 정육면체 생성
    return new THREE.BoxGeometry(1, 1, 1, 2, 2, 2, 0.1); // 마지막 매개변수가 둥근 정도
  }, []);

  return (
    <mesh geometry={geometry} position={position} scale={scale} {...props}>
      <meshStandardMaterial 
        color="white" 
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

// GitHub Cat 컴포넌트 추가
function GitHubCat(props) {
  const { scene } = useGLTF('/githubcat.glb');
  
  // GitHub Cat 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 동상처럼 어두운 회색 재질 적용
        child.material = new THREE.MeshStandardMaterial({
          color: '#404040', // 더 어두운 회색
          roughness: 0.8,
          metalness: 0.2
        });
      }
    });
    return cloned;
  }, [scene]);
  
  return <primitive object={clonedScene} {...props} />;
}

// Mailbox 컴포넌트 추가
function Mailbox(props) {
  const { scene } = useGLTF('/mailbox.glb');
  
  // Mailbox 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 동상처럼 어두운 회색 재질 적용
        child.material = new THREE.MeshStandardMaterial({
          color: '#404040', // 더 어두운 회색
          roughness: 0.8,
          metalness: 0.2
        });
      }
    });
    return cloned;
  }, [scene]);
  
  return <primitive object={clonedScene} {...props} />;
}

// GitHub Cat과 RoundedCube를 묶는 그룹 컴포넌트
function GitHubCatGroup({ position = [0, 0, 0], ...props }) {
  return (
    <group position={position} {...props}>
      {/* 둥근 정육면체 (GitHub Cat의 받침대) */}
      <RoundedCube 
        position={[0, 2, 0]} 
        scale={[4, 4, 4]}
        castShadow
        receiveShadow
      />
      
      {/* 정육면체 앞 바닥에 흰색 테두리 사각형 */}
      <mesh position={[0, 0.01, 5]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
        <ringGeometry args={[3, 3.5, 4]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
      </mesh>
      
      {/* 정육면체 앞면에 "Github" 텍스트 */}
      <Text
        position={[0, 2, 2.1]} // 정육면체 가운데에 위치
        fontSize={1.2}
        color="black"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, 0]}
      >
        Github
      </Text>
      
      {/* GitHub Cat 모델 */}
      <GitHubCat 
        position={[0, 6.2, 0]} 
        scale={[2.3, 2.3, 2.3]} 
        rotation={[0, 0, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

// Instagram Logo 컴포넌트 추가
function InstagramLogo(props) {
  const { scene } = useGLTF('/instagramlogo.glb');
  
  // Instagram Logo 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 원래 색상 유지 (재질 변경하지 않음)
      }
    });
    return cloned;
  }, [scene]);
  
  return <primitive object={clonedScene} {...props} />;
}

// Mailbox와 RoundedCube를 묶는 그룹 컴포넌트
function MailboxGroup({ position = [0, 0, 0], ...props }) {
  return (
    <group position={position} {...props}>
      {/* 둥근 정육면체 (Mailbox의 받침대) */}
      <RoundedCube 
        position={[0, 2, 0]} 
        scale={[4, 4, 4]}
        castShadow
        receiveShadow
      />
      
      {/* 정육면체 앞 바닥에 흰색 테두리 사각형 */}
      <mesh position={[0, 0.01, 5]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
        <ringGeometry args={[3, 3.5, 4]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
      </mesh>
      
      {/* 정육면체 앞면에 "Mail" 텍스트 */}
      <Text
        position={[0, 2, 2.1]} // 정육면체 가운데에 위치
        fontSize={1.2}
        color="black"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, 0]}
      >
        Mail
      </Text>
      
      {/* Mailbox 모델 */}
      <Mailbox 
        position={[0, 6, 0]} 
        scale={[2.3, 2.3, 2.3]} 
        rotation={[0, 0, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

// Instagram Logo와 RoundedCube를 묶는 그룹 컴포넌트
function InstagramGroup({ position = [0, 0, 0], ...props }) {
  return (
    <group position={position} {...props}>
      {/* 둥근 정육면체 (Instagram Logo의 받침대) */}
      <RoundedCube 
        position={[0, 2, 0]} 
        scale={[4, 4, 4]}
        castShadow
        receiveShadow
      />
      
      {/* 정육면체 앞 바닥에 흰색 테두리 사각형 */}
      <mesh position={[0, 0.01, 5]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
        <ringGeometry args={[3, 3.5, 4]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
      </mesh>
      
      {/* 정육면체 앞면에 "SNS" 텍스트 */}
      <Text
        position={[0, 2, 2.1]} // 정육면체 가운데에 위치
        fontSize={1.2}
        color="black"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, 0]}
      >
        SNS
      </Text>
      
      {/* Instagram Logo 모델 */}
      <InstagramLogo 
        position={[0, 6.2, 0]} 
        scale={[6, 6, 6]} 
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

// Toolbox 컴포넌트 추가
function Toolbox(props) {
  const { scene } = useGLTF('/toolbox.glb');
  
  // Toolbox 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 원래 재질 유지 (색상 변경하지 않음)
      }
    });
    return cloned;
  }, [scene]);
  
  return <primitive object={clonedScene} {...props} />;
}

useGLTF.preload('/githubcat.glb');
useGLTF.preload('/mailbox.glb');
useGLTF.preload('/instagramlogo.glb');
useGLTF.preload('/toolbox.glb');

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
      <PortalBase position={portalPosition} scale={20} castShadow receiveShadow />
      <PortalVortex position={[-19.7, 8, -22]} scale={[7, 9.8, 1]} castShadow receiveShadow />
      
      {/* Level3 Portal */}
      <PortalBase position={portalLevel3Position} scale={20} castShadow receiveShadow />
      <PortalVortexLevel3 position={[20.3, 8, -22]} scale={[7, 9.8, 1]} castShadow receiveShadow />
      
      {/* Path stones leading to the portal */}
      <PathStone position={[-22, 0.2, -13]} scale={7} rotation={[0, -0.2, 0]} castShadow receiveShadow />
      
      {/* Small stones scattered around the level */}
      {stones.map((stone, index) => (
        <SmallStoneFlatA 
          key={index} 
          position={stone.position} 
          scale={stone.scale} 
          rotation={stone.rotation}
          castShadow
          receiveShadow
        />
      ))}

      {/* Palm trees scattered around the level */}
      {palmTrees.map((tree, index) => (
        <PalmTree 
          key={index} 
          position={tree.position} 
          scale={tree.scale} 
          rotation={tree.rotation}
          castShadow
          receiveShadow
        />
      ))}

      {/* NPC Character */}
      <NPCCharacter position={[-27, 0, -8]} playerRef={characterRef} />
      
      {/* GitHub Cat 그룹 (둥근 정육면체 + GitHub Cat) */}
      <GitHubCatGroup 
        position={[-6, 0.2, 20]}
        castShadow
        receiveShadow
      />
      
      {/* Mailbox 그룹 (둥근 정육면체 + Mailbox) */}
      <MailboxGroup 
        position={[0, 0.2, 20]}
        castShadow
        receiveShadow
      />
      
      {/* Instagram 그룹 (둥근 정육면체 + Instagram Logo) */}
      <InstagramGroup 
        position={[6, 0.2, 20]}
        castShadow
        receiveShadow
      />
      
      {/* 도구상자 추가 */}
      <Toolbox 
        position={[-12, 1.2, 25]} 
        scale={[1.5, 1.5, 1.5]} 
        rotation={[0, Math.PI / 4, 0]}
        castShadow
        receiveShadow
      />
      
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
        castShadow
        receiveShadow
      />
      
      {/* Level1으로 돌아가는 포탈 - 캐릭터 뒤쪽에 배치 */}
      <PortalBase position={[0, 7.5, 23.5]} scale={20} castShadow receiveShadow />
      <PortalVortex position={[0.3, 8, 22]} scale={[7, 9.8, 1]} castShadow receiveShadow />
      
      {/* Floor with level2map.png texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={level2Texture} />
      </mesh>
    </>
  );
}

function GameMap(props) {
  const { scene } = useGLTF('/GameMap.glb');
  
  // GameMap 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
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

function GameMap2(props) {
  const { scene } = useGLTF('/GameMap2.glb');
  
  // GameMap2 모델을 복사해서 각 인스턴스가 독립적으로 작동하도록 함
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

useGLTF.preload('/GameMap.glb');
useGLTF.preload('/GameMap2.glb');

function Level3() {
  // Map1.png 텍스처 로드
  const map1Texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load('/Map1.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }, []);

  return (
    <>
      <Sky />
      
      {/* GameMap.glb 모델 렌더링 - 크기와 각도 조절 가능 */}
      <GameMap 
        position={[50, 0, -50]} 
        scale={[1, 1, 1]}  // X, Y, Z 각각 크기 조절 가능
        rotation={[0, Math.PI / 2, 0]}  // Y축으로 45도 회전
        castShadow
        receiveShadow
      />
      
      {/* GameMap2.glb 모델 렌더링 - 크기와 각도 조절 가능 */}
      <GameMap2 
        position={[46, -2.2, -130]} 
        scale={[0.8, 0.8, 0.8]}  // X, Y, Z 각각 크기 조절 가능
        rotation={[0, Math.PI / 2, 0]}  // 회전 없음
        castShadow
        receiveShadow
      />
      
      {/* Map1.png 텍스처를 GameMap 밑에 배치 */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[46, 0.01, -50]} receiveShadow>
        <planeGeometry args={[81, 81]} />
        <meshStandardMaterial map={map1Texture} />
      </mesh>
      
      {/* Level1로 가는 포탈 - Level3 포탈과 똑같은 색상과 모양 */}
      <PortalBase position={portalLevel3ToLevel1Position} scale={20} castShadow receiveShadow />
      <PortalVortexLevel3 position={[0.3, 8, 22]} scale={[7, 9.8, 1]} castShadow receiveShadow />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
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
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[50, 50, 25]} 
          intensity={6} 
          castShadow
          shadow-mapSize-width={8192}
          shadow-mapSize-height={8192}
          shadow-camera-far={1000}
          shadow-camera-left={-500}
          shadow-camera-right={500}
          shadow-camera-top={500}
          shadow-camera-bottom={-500}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-radius={4}
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
            if (characterRef.current?.handleSetCarRef) {
              characterRef.current.handleSetCarRef(ref);
            }
          }} characterRef={characterRef} /> : 
           gameState === 'playing_level3' ? <Level3 /> : <Level1 characterRef={characterRef} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;