import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface SandwormMaterialLibrary {
  titaniumArmor: THREE.MeshPhysicalMaterial;
  titaniumCrest: THREE.MeshPhysicalMaterial;
  gunmetalChassis: THREE.MeshStandardMaterial;
  hydraulicChrome: THREE.MeshPhysicalMaterial;
  copperConduit: THREE.MeshStandardMaterial;
  internalGearSteel: THREE.MeshStandardMaterial;
  tungstenTeeth: THREE.MeshPhysicalMaterial;
  plasmaCore: THREE.MeshStandardMaterial;
  furnaceCore: THREE.MeshStandardMaterial;
  opticalLens: THREE.MeshPhysicalMaterial;
  sensorEmitter: THREE.MeshStandardMaterial;
  heatShimmer: THREE.ShaderMaterial;
  selectionHighlight: THREE.MeshBasicMaterial;
  setInternalXRay: (enabled: boolean) => void;
  setWireframe: (enabled: boolean) => void;
  updateUniforms: (elapsed: number, energyIntensity: number, shimmerEnabled: boolean) => void;
  dispose: () => void;
}

export function createSandwormMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): SandwormMaterialLibrary {
  // Primary weathered brushed titanium hull plates (higher roughness ~0.48 from desert sandblasting)
  const titaniumArmor = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8e96a0'),
    map: textures.titaniumMap,
    roughnessMap: textures.titaniumRoughness,
    normalMap: textures.titaniumNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    metalness: 0.78,
    roughness: 0.52,
    anisotropy: isSoftwareGl ? 0 : 0.45,
    anisotropyRotation: Math.PI * 0.5,
    clearcoat: 0.08,
    clearcoatRoughness: 0.65,
    envMapIntensity: 1.15,
  });

  // Slightly darker oxidized dorsal spine plates for strong multi-tone silhouette read
  const titaniumCrest = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5a6069'),
    map: textures.titaniumMap,
    roughnessMap: textures.titaniumRoughness,
    normalMap: textures.titaniumNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    metalness: 0.82,
    roughness: 0.44,
    clearcoat: 0.14,
    clearcoatRoughness: 0.48,
    envMapIntensity: 1.25,
  });

  // Forged matte dark gunmetal bulkhead rings (roughness 0.72 -> >= 0.25 contrast vs chrome/teeth)
  const gunmetalChassis = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c3037'),
    map: textures.gunmetalMap,
    roughnessMap: textures.gunmetalRoughness,
    normalMap: textures.gunmetalNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    metalness: 0.68,
    roughness: 0.72,
    envMapIntensity: 0.9,
  });

  // Mirror-honed hydraulic piston rods (roughness 0.14 -> crisp metallic highlights)
  const hydraulicChrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dce3ec'),
    metalness: 0.96,
    roughness: 0.14,
    anisotropy: isSoftwareGl ? 0 : 0.7,
    envMapIntensity: 1.45,
  });

  // Warm industrial copper heat pipes & power busbars
  const copperConduit = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b86b3a'),
    metalness: 0.88,
    roughness: 0.34,
    envMapIntensity: 1.2,
  });

  // Hardened machined steel for rotating internal gears & helical shafts
  const internalGearSteel = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6f7785'),
    metalness: 0.9,
    roughness: 0.26,
    envMapIntensity: 1.3,
  });

  // Tungsten-carbide crusher fangs (satin-polished cutting edges)
  const tungstenTeeth = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8ccd2'),
    metalness: 0.94,
    roughness: 0.19,
    clearcoat: 0.22,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.4,
  });

  // Incandescent amber-orange plasma core rings between segments
  const plasmaCore = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff841a'),
    emissive: new THREE.Color('#ff5e00'),
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.28,
    toneMapped: false,
  });

  // Deep interior throat furnace core
  const furnaceCore = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffb84d'),
    emissive: new THREE.Color('#ff6a00'),
    emissiveIntensity: 3.1,
    metalness: 0.1,
    roughness: 0.2,
    toneMapped: false,
  });

  // Sapphire optical sensor domes (software-GL safe transmission fallback)
  const opticalLens = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2d5a7b'),
    metalness: 0.1,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.82,
    transparent: isSoftwareGl,
    opacity: isSoftwareGl ? 0.65 : 1.0,
    ior: 1.76,
    thickness: 0.8,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color('#0c283d'),
    emissiveIntensity: 0.6,
  });

  // Illuminated amber sensor telemetry diodes
  const sensorEmitter = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffaa33'),
    emissive: new THREE.Color('#ff8800'),
    emissiveIntensity: 2.4,
    metalness: 0.1,
    roughness: 0.2,
    toneMapped: false,
  });

  // Subtle WebGL GLSL Heat Distortion / Convection Shimmer around energy cores
  const heatShimmer = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.45 },
      uColor: { value: new THREE.Color('#ff8826') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.y * 5.0 + uTime * 7.5 + pos.x * 3.0) * 0.06 * uIntensity;
        float wave2 = cos(pos.z * 6.0 - uTime * 9.0) * 0.04 * uIntensity;
        pos += normal * (wave + wave2);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;

      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.4);
        float ripple = 0.5 + 0.5 * sin(vUv.y * 28.0 - uTime * 11.0 + sin(vUv.x * 16.0 + uTime * 4.0) * 2.0);
        float alpha = fresnel * ripple * 0.28 * uIntensity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });

  const selectionHighlight = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fbbf24'),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const allMaterials: THREE.Material[] = [
    titaniumArmor,
    titaniumCrest,
    gunmetalChassis,
    hydraulicChrome,
    copperConduit,
    internalGearSteel,
    tungstenTeeth,
    plasmaCore,
    furnaceCore,
    opticalLens,
    sensorEmitter,
    heatShimmer,
    selectionHighlight,
  ];

  return {
    titaniumArmor,
    titaniumCrest,
    gunmetalChassis,
    hydraulicChrome,
    copperConduit,
    internalGearSteel,
    tungstenTeeth,
    plasmaCore,
    furnaceCore,
    opticalLens,
    sensorEmitter,
    heatShimmer,
    selectionHighlight,

    setInternalXRay: (enabled: boolean) => {
      const targetOpacity = enabled ? 0.16 : 1.0;
      const shouldTransparent = enabled;

      if (titaniumArmor.transparent !== shouldTransparent) {
        titaniumArmor.transparent = shouldTransparent;
        titaniumArmor.depthWrite = !shouldTransparent;
        titaniumArmor.needsUpdate = true;
      }
      titaniumArmor.opacity = targetOpacity;

      if (titaniumCrest.transparent !== shouldTransparent) {
        titaniumCrest.transparent = shouldTransparent;
        titaniumCrest.depthWrite = !shouldTransparent;
        titaniumCrest.needsUpdate = true;
      }
      titaniumCrest.opacity = enabled ? 0.22 : 1.0;
    },

    setWireframe: (enabled: boolean) => {
      titaniumArmor.wireframe = enabled;
      titaniumCrest.wireframe = enabled;
      gunmetalChassis.wireframe = enabled;
      internalGearSteel.wireframe = enabled;
    },

    updateUniforms: (elapsed: number, energyIntensity: number, shimmerEnabled: boolean) => {
      const pulse = 0.88 + Math.sin(elapsed * 3.4) * 0.12;
      plasmaCore.emissiveIntensity = (1.6 + energyIntensity * 1.65) * pulse;
      furnaceCore.emissiveIntensity = (2.2 + energyIntensity * 2.2) * (0.92 + Math.sin(elapsed * 7.5) * 0.08);
      heatShimmer.uniforms.uTime.value = elapsed;
      heatShimmer.uniforms.uIntensity.value = shimmerEnabled ? 0.55 + energyIntensity * 0.65 : 0.0;
      heatShimmer.visible = shimmerEnabled;
    },

    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
