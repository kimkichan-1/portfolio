import React from 'react';
import { useGLTF } from '@react-three/drei';

function SquareForestTile(props) {
  const { scene } = useGLTF('/resources/kaykit_medieval_builder_pack_1.0/Models/tiles/square/gltf/square_forest.gltf.glb');
  return <primitive object={scene} {...props} />;
}

useGLTF.preload('/resources/kaykit_medieval_builder_pack_1.0/Models/tiles/square/gltf/square_forest.gltf.glb');

export default SquareForestTile;
