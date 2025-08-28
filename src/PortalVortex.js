
import React, { useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const VortexMaterial = shaderMaterial(
  // Uniforms
  {
    uTime: 0,
    uColorStart: new THREE.Color('#87CEEB'),
    uColorEnd: new THREE.Color('#FFFFFF'),
  },
  // Vertex Shader
  `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  // Fragment Shader
  `
  uniform float uTime;
  uniform vec3 uColorStart;
  uniform vec3 uColorEnd;
  varying vec2 vUv;

  // 2D Random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // 2D Noise function
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);

    // Swirl effect
    float angle = atan(uv.y, uv.x);
    float angleOffset = (1.0 / (dist + 0.1)) * uTime * 0.2;
    angle += angleOffset;

    // Create new UVs from polar coordinates
    vec2 swirlUv = vec2(cos(angle), sin(angle)) * dist;

    // Create a noisy, swirling pattern
    float n = noise(swirlUv * 5.0 + uTime * 0.5);
    
    // Fade to black at the center
    float intensity = smoothstep(0.0, 0.5, dist);
    
    // Mix colors
    vec3 color = mix(uColorStart, uColorEnd, n);

    gl_FragColor = vec4(color * intensity, intensity);
  }
  `
);

extend({ VortexMaterial });

export function PortalVortex(props) {
  const materialRef = useRef();

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh {...props}>
      <planeGeometry args={[1, 1]} />
      <vortexMaterial ref={materialRef} transparent={true} />
    </mesh>
  );
}
