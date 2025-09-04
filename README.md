# 🎮 3D 포트폴리오 게임

React와 Three.js를 활용한 인터랙티브 3D 포트폴리오 웹사이트입니다. 3개의 레벨로 구성된 가상 세계에서 캐릭터를 조작하며 다양한 프로젝트를 탐험할 수 있습니다.

## ✨ 주요 기능

### 🎯 3D 게임 환경
- **3개의 레벨**: 각각 다른 테마와 기능을 가진 독특한 레벨
- **실시간 3D 렌더링**: Three.js와 React Three Fiber를 활용한 고품질 3D 그래픽
- **동적 조명**: 그림자와 조명 효과가 적용된 몰입감 있는 환경

### 🚶‍♂️ 캐릭터 시스템
- **애니메이션 캐릭터**: 걷기, 뛰기, 대기 등 다양한 애니메이션
- **키보드 조작**: WASD 키로 캐릭터 이동, Shift로 달리기
- **실시간 사운드**: 발걸음 소리와 상호작용 사운드

### 🚗 자동차 시스템 (Level 2)
- **자동차 탑승/하차**: E키로 자동차 상호작용
- **현실적인 운전**: 전륜조향, 후륜구동, 가속도 시스템
- **바퀴 애니메이션**: 실제 바퀴 회전과 조향 효과

### 🌟 포털 시스템
- **레벨 간 이동**: 포털을 통한 매끄러운 레벨 전환
- **시각적 효과**: 커스텀 셰이더를 활용한 포털 소용돌이 효과
- **부드러운 전환**: 애니메이션과 함께하는 레벨 전환

### 🎨 시각적 효과
- **커스텀 셰이더**: 그라데이션 바닥과 포털 효과
- **동적 텍스처**: 각 레벨별 고유한 환경 텍스처
- **3D 모델**: 다양한 3D 에셋을 활용한 풍부한 환경

## 🎮 조작법

| 키 | 기능 |
|---|---|
| `W` | 앞으로 이동 |
| `S` | 뒤로 이동 |
| `A` | 왼쪽으로 이동 |
| `D` | 오른쪽으로 이동 |
| `Shift` | 달리기 (WASD와 함께) |
| `E` | 자동차 탑승/하차 (Level 2) |
| `C` | 카메라 위치 로그 (개발자용) |

## 🗺️ 레벨 구성

### Level 1: 자연 환경
- **환경**: 연두색 그라데이션 바닥과 팜트리
- **NPC**: 환영 메시지와 함께하는 NPC 캐릭터
- **포털**: Level 2와 Level 3으로 이동하는 포털
- **특징**: 자연스러운 환경과 평화로운 분위기

### Level 2: 자동차 레이싱
- **환경**: 도시 스타일의 레이싱 트랙
- **자동차**: 미래형 레이싱카 탑승 가능
- **운전**: 현실적인 자동차 물리 시스템
- **특징**: 고속 주행과 자동차 조작의 재미

### Level 3: 건축 환경
- **환경**: 3D 건물 모델과 도시 풍경
- **지형**: 복잡한 건축 구조물
- **특징**: 건축과 도시 디자인을 보여주는 환경

## 🛠️ 기술 스택

### Frontend
- **React 19.1.1**: 최신 React 기능 활용
- **Three.js 0.179.1**: 3D 그래픽 렌더링
- **React Three Fiber 9.3.0**: React와 Three.js 통합
- **React Three Drei 10.7.4**: Three.js 헬퍼 라이브러리

### 3D 에셋
- **캐릭터**: Ultimate Animated Character Pack
- **자연 환경**: Ultimate Nature Pack, Nature Kit
- **자동차**: Kenney Car Kit
- **건축**: 커스텀 3D 모델 (GameMap.glb, GameMap2.glb)

### 오디오
- **효과음**: 발걸음 소리, 자동차 소리
- **포맷**: WAV, MP3 지원

## 🚀 설치 및 실행

### 필요 조건
- Node.js 14.0 이상
- npm 또는 yarn

### 설치
```bash
# 저장소 클론
git clone [repository-url]
cd portfolio-game

# 의존성 설치
npm install
```

### 개발 서버 실행
```bash
npm start
```
브라우저에서 `http://localhost:3000`으로 접속

### 프로덕션 빌드
```bash
npm run build
```

## 📁 프로젝트 구조

```
portfolio-game/
├── public/
│   ├── resources/          # 3D 모델 및 텍스처
│   │   ├── kenney_car-kit/     # 자동차 모델
│   │   ├── Nature-Kit/         # 자연 환경 모델
│   │   ├── Ultimate Animated Character Pack/  # 캐릭터 모델
│   │   └── Ultimate Nature Pack/              # 자연 모델
│   ├── sounds/             # 오디오 파일
│   └── *.glb               # 3D 모델 파일
├── src/
│   ├── App.js              # 메인 애플리케이션
│   ├── PortalVortex.js     # 포털 셰이더 컴포넌트
│   ├── useKeyboardControls.js  # 키보드 입력 처리
│   └── App.css             # 스타일
└── package.json
```

## 🎨 커스텀 셰이더

프로젝트는 커스텀 GLSL 셰이더를 활용합니다:

- **GradientFloorMaterial**: 그라데이션 바닥과 그림자 효과
- **VortexMaterial**: 포털의 소용돌이 효과
- **실시간 애니메이션**: 시간 기반 셰이더 애니메이션

## 🔧 개발 정보

### 성능 최적화
- **모델 프리로딩**: 필요한 3D 모델 사전 로드
- **인스턴싱**: 동일한 모델의 여러 인스턴스 최적화
- **그림자 최적화**: 효율적인 그림자 렌더링

### 브라우저 지원
- Chrome (권장)
- Firefox
- Safari
- Edge

## 📝 라이선스

이 프로젝트는 다음 에셋을 사용합니다:
- **Kenney Assets**: MIT 라이선스
- **Ultimate Character Pack**: 상업적 사용 가능
- **Ultimate Nature Pack**: 상업적 사용 가능

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 연락처

프로젝트에 대한 문의사항이 있으시면 언제든 연락해주세요!

---

**즐거운 3D 포트폴리오 탐험을 경험해보세요! 🎮✨**