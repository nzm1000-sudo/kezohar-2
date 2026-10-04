// Tree-shaken subset of three.js r186 + the post-processing addons the hero uses.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, Group, Mesh, Points, InstancedMesh,
  HemisphereLight, DirectionalLight, PointLight,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial,
  BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, ConeGeometry, ShapeGeometry, Shape,
  BufferGeometry, BufferAttribute, InstancedBufferAttribute,
  Object3D, Vector2, Vector3, Matrix4, Euler, Quaternion, TextureLoader, SRGBColorSpace,
  ACESFilmicToneMapping, AdditiveBlending, BackSide, DoubleSide, MathUtils, Timer, Clock,
  ShaderChunk, WebGLRenderTarget, HalfFloatType,
} from 'three';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
export { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
