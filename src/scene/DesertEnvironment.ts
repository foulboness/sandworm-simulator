import * as THREE from 'three';
import type { EnvironmentSettings, TimeOfDay } from '../types/sandwraith';
import { getTerrainHeight } from './terrainMath';
import type { ProceduralTextureSet } from './textures';

interface TimeOfDayPalette {
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  zenithColor: THREE.Color;
  horizonColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  starIntensity: number;
  godRayOpacity: number;
  exposure: number;
}

const TOD_PALETTES: Record<TimeOfDay, TimeOfDayPalette> = {
  dawn: {
    sunElevationDeg: 11,
    sunAzimuthDeg: 54,
    sunColor: new THREE.Color('#ffae70'),
    sunIntensity: 2.35,
    hemiSky: new THREE.Color('#6f8bb8'),
    hemiGround: new THREE.Color('#7a5136'),
    hemiIntensity: 0.72,
    rimColor: new THREE.Color('#88b4e8'),
    rimIntensity: 0.78,
    zenithColor: new THREE.Color('#223354'),
    horizonColor: new THREE.Color('#d98d62'),
    fogColor: new THREE.Color('#c9855e'),
    fogDensity: 0.0046,
    starIntensity: 0.25,
    godRayOpacity: 0.14,
    exposure: 1.05,
  },
  noon: {
    sunElevationDeg: 58,
    sunAzimuthDeg: 36,
    sunColor: new THREE.Color('#fff1d6'),
    sunIntensity: 3.1,
    hemiSky: new THREE.Color('#9ec4e8'),
    hemiGround: new THREE.Color('#b68652'),
    hemiIntensity: 0.92,
    rimColor: new THREE.Color('#a4cbe8'),
    rimIntensity: 0.65,
    zenithColor: new THREE.Color('#4778a8'),
    horizonColor: new THREE.Color('#e2c396'),
    fogColor: new THREE.Color('#dcc094'),
    fogDensity: 0.0036,
    starIntensity: 0.0,
    godRayOpacity: 0.09,
    exposure: 1.02,
  },
  golden: {
    sunElevationDeg: 17,
    sunAzimuthDeg: 42,
    sunColor: new THREE.Color('#ffbe6b'),
    sunIntensity: 3.05,
    hemiSky: new THREE.Color('#7c9ec2'),
    hemiGround: new THREE.Color('#9e6638'),
    hemiIntensity: 0.85,
    rimColor: new THREE.Color('#8eb6df'),
    rimIntensity: 0.88,
    zenithColor: new THREE.Color('#2a4263'),
    horizonColor: new THREE.Color('#df9b58'),
    fogColor: new THREE.Color('#d49354'),
    fogDensity: 0.0042,
    starIntensity: 0.02,
    godRayOpacity: 0.17,
    exposure: 1.08,
  },
  dusk: {
    sunElevationDeg: 6,
    sunAzimuthDeg: -38,
    sunColor: new THREE.Color('#ff7940'),
    sunIntensity: 1.95,
    hemiSky: new THREE.Color('#465278'),
    hemiGround: new THREE.Color('#5a3522'),
    hemiIntensity: 0.62,
    rimColor: new THREE.Color('#6f93c9'),
    rimIntensity: 0.95,
    zenithColor: new THREE.Color('#141c33'),
    horizonColor: new THREE.Color('#a85638'),
    fogColor: new THREE.Color('#874832'),
    fogDensity: 0.005,
    starIntensity: 0.55,
    godRayOpacity: 0.13,
    exposure: 1.04,
  },
  night: {
    sunElevationDeg: 28,
    sunAzimuthDeg: -50,
    sunColor: new THREE.Color('#8bb4e8'), // moonlight key
    sunIntensity: 1.15,
    hemiSky: new THREE.Color('#21304d'),
    hemiGround: new THREE.Color('#29201a'),
    hemiIntensity: 0.52,
    rimColor: new THREE.Color('#4f78ad'),
    rimIntensity: 0.82,
    zenithColor: new THREE.Color('#070b14'),
    horizonColor: new THREE.Color('#1c2536'),
    fogColor: new THREE.Color('#18202e'),
    fogDensity: 0.0052,
    starIntensity: 1.0,
    godRayOpacity: 0.05,
    exposure: 1.05,
  },
};

const _sunDir = new THREE.Vector3();
const _tmpColor = new THREE.Color();

export class DesertEnvironment {
  public readonly root = new THREE.Group();
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly fog: THREE.FogExp2;

  private readonly terrainMesh: THREE.Mesh;
  private readonly terrainMat: THREE.MeshStandardMaterial;
  private terrainUniforms: {
    uBreachPoints: { value: THREE.Vector3[] };
    uDisplaceStrength: { value: number };
    uTime: { value: number };
  } | null = null;

  private readonly skyMat: THREE.ShaderMaterial;
  private readonly godRaysGroup = new THREE.Group();
  private readonly godRayMat: THREE.ShaderMaterial;

  private readonly outpostsGroup = new THREE.Group();
  private radarDish: THREE.Object3D | null = null;
  private readonly thumperPistons: THREE.Object3D[] = [];
  private beaconMat: THREE.MeshStandardMaterial | null = null;

  private readonly sandstormPoints: THREE.Points;
  private readonly sandstormMat: THREE.ShaderMaterial;

  // Ballistic sand eruption fountain around active worm breaches
  private readonly eruptionCount = 640;
  private readonly eruptionGeo: THREE.BufferGeometry;
  private readonly eruptionPositions: Float32Array;
  private readonly eruptionVelocities: Float32Array;
  private readonly eruptionLifetimes: Float32Array;
  private readonly eruptionPoints: THREE.Points;
  private readonly eruptionMat: THREE.PointsMaterial;

  // Engineering spatial reference grid
  private readonly engineeringGridGroup = new THREE.Group();

  // Smooth interpolated state for Time of Day transitions
  private currentSunElev = TOD_PALETTES.golden.sunElevationDeg;
  private currentSunAzim = TOD_PALETTES.golden.sunAzimuthDeg;
  private currentFogDensity = TOD_PALETTES.golden.fogDensity;
  private currentExposure = TOD_PALETTES.golden.exposure;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    textures: ProceduralTextureSet,
    isSoftwareGl: boolean,
  ) {
    this.root.name = 'DesertEnvironment';

    // ------------------------------------------------------------------
    // 1. HORIZON-MATCHED ATMOSPHERIC FOG & 3-POINT + HEMI LIGHTING RIG
    // ------------------------------------------------------------------
    const initial = TOD_PALETTES.golden;
    this.fog = new THREE.FogExp2(initial.fogColor.getHex(), initial.fogDensity);
    this.scene.fog = this.fog;
    this.scene.background = initial.fogColor.clone();

    this.sunLight = new THREE.DirectionalLight(initial.sunColor, initial.sunIntensity);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 15;
    this.sunLight.shadow.camera.far = 310;
    const shadowBound = 92;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.04;
    this.root.add(this.sunLight);
    this.root.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(
      initial.hemiSky,
      initial.hemiGround,
      initial.hemiIntensity,
    );
    this.root.add(this.hemiLight);

    // Cool sky rim light opposite the sun for crisp metallic edge separation
    this.rimLight = new THREE.DirectionalLight(initial.rimColor, initial.rimIntensity);
    this.rimLight.position.set(-70, 42, -85);
    this.root.add(this.rimLight);

    // ------------------------------------------------------------------
    // 2. PROCEDURAL RAYLEIGH/MIE SKY DOME + VOLUMETRIC GOD-RAYS
    // ------------------------------------------------------------------
    const skyGeo = new THREE.SphereGeometry(430, 36, 24);
    this.geometries.push(skyGeo);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.6, 0.3, -0.7).normalize() },
        uZenithColor: { value: initial.zenithColor.clone() },
        uHorizonColor: { value: initial.horizonColor.clone() },
        uSunColor: { value: initial.sunColor.clone() },
        uStarIntensity: { value: initial.starIntensity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uStarIntensity;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);

          // Atmospheric desert gradient with dusty horizon haze band
          float horizonBand = pow(1.0 - elev, 3.2);
          vec3 col = mix(uZenithColor, uHorizonColor, horizonBand);

          // Mie forward scattering solar glow + crisp desert sun disc
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 12.0) * 0.45 + pow(sunDot, 96.0) * 0.65;
          float disc = smoothstep(0.9985, 0.9994, sunDot);
          col += uSunColor * (halo + disc * 2.2);

          // Subtle twilight / desert night starfield
          if (uStarIntensity > 0.01 && dir.y > 0.05) {
            vec3 starCell = floor(dir * 210.0);
            float h = hash(starCell);
            if (h > 0.994) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + h * 120.0);
              col += vec3(0.85, 0.92, 1.0) * uStarIntensity * twinkle * smoothstep(0.05, 0.35, dir.y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(this.skyMat);
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    skyMesh.frustumCulled = false;
    this.root.add(skyMesh);

    // Volumetric Sun Light Shafts (soft additive cones descending through desert dust)
    this.godRayMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: initial.sunColor.clone() },
        uOpacity: { value: initial.godRayOpacity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mv.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
          float edgeSoft = pow(abs(dot(normalize(vViewPos), normalize(vNormal))), 1.4);
          float vertFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          float shimmer = 0.8 + 0.2 * sin(vUv.x * 18.0 + uTime * 0.5);
          float alpha = edgeSoft * vertFade * shimmer * uOpacity;
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.godRayMat);

    const shaftSpecs = [
      { topR: 8, botR: 38, len: 175, offset: new THREE.Vector3(-18, 44, -22) },
      { topR: 12, botR: 52, len: 190, offset: new THREE.Vector3(24, 52, -38) },
      { topR: 9, botR: 44, len: 165, offset: new THREE.Vector3(0, 48, 8) },
    ];
    for (const s of shaftSpecs) {
      const coneGeo = new THREE.CylinderGeometry(s.topR, s.botR, s.len, 18, 1, true);
      this.geometries.push(coneGeo);
      const cone = new THREE.Mesh(coneGeo, this.godRayMat);
      cone.position.copy(s.offset);
      this.godRaysGroup.add(cone);
    }
    this.root.add(this.godRaysGroup);

    // ------------------------------------------------------------------
    // 3. ENDLESS GOLDEN DUNES WITH REAL-TIME SAND DISPLACEMENT SHADER
    // ------------------------------------------------------------------
    const terrainSize = 520;
    const terrainSegs = isSoftwareGl ? 132 : 184;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(x, z));
    }
    terrainGeo.computeVertexNormals();
    this.geometries.push(terrainGeo);

    const initialBreaches = Array.from({ length: 12 }, () => new THREE.Vector3(9999, -999, 9999));

    this.terrainMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e3ba82'),
      map: textures.sandMap,
      normalMap: textures.sandNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: textures.sandRoughness,
      roughness: 0.92,
      metalness: 0.03,
      envMapIntensity: 0.55,
    });

    // Inject real-time sand wake/breach mound displacement into full PBR MeshStandardMaterial!
    this.terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uBreachPoints = { value: initialBreaches };
      shader.uniforms.uDisplaceStrength = { value: 1.0 };
      shader.uniforms.uTime = { value: 0.0 };
      this.terrainUniforms = {
        uBreachPoints: shader.uniforms.uBreachPoints,
        uDisplaceStrength: shader.uniforms.uDisplaceStrength,
        uTime: shader.uniforms.uTime,
      };

      shader.vertexShader =
        `
        uniform vec3 uBreachPoints[12];
        uniform float uDisplaceStrength;
        uniform float uTime;
        varying float vDisplaceWake;
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float wakeTotal = 0.0;
        if (uDisplaceStrength > 0.01) {
          for (int i = 0; i < 12; i++) {
            vec3 bp = uBreachPoints[i];
            float d = length(transformed.xz - bp.xz);
            if (d < 22.0) {
              // Raised displaced sand crater berm around the breach radius (~7.5m) + outer ripple
              float berm = exp(-pow((d - 7.4) / 3.8, 2.0)) * 3.1;
              float centerDepression = -exp(-pow(d / 4.2, 2.0)) * 1.45;
              float ripple = sin(d * 1.45 - uTime * 4.5) * exp(-d * 0.14) * 0.42;
              wakeTotal += (berm + centerDepression + ripple);
            }
          }
          wakeTotal = clamp(wakeTotal, -2.5, 4.8) * uDisplaceStrength;
          transformed.y += wakeTotal;
        }
        vDisplaceWake = clamp(abs(wakeTotal) * 0.35, 0.0, 1.0);
        `,
      );

      shader.fragmentShader =
        `
        varying float vDisplaceWake;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        // Freshly churned subterranean sand appears slightly darker and richer ochre
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.76, 0.70, 0.62), vDisplaceWake * 0.65);
        `,
      );
    };
    this.materials.push(this.terrainMat);

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMat);
    this.terrainMesh.receiveShadow = !isSoftwareGl;
    this.root.add(this.terrainMesh);

    // ------------------------------------------------------------------
    // 4. ABANDONED INDUSTRIAL INSTALLATIONS & SANDSTONE ROCK OUTCROPS
    // ------------------------------------------------------------------
    this.buildIndustrialInstallations(textures, !isSoftwareGl);
    this.buildRockOutcrops(!isSoftwareGl);
    this.root.add(this.outpostsGroup);

    // ------------------------------------------------------------------
    // 5. DYNAMIC SANDSTORM & AIRBORNE PARTICLES (GPU ShaderMaterial)
    // ------------------------------------------------------------------
    const stormCount = 1900;
    const stormGeo = new THREE.BufferGeometry();
    const stormPositions = new Float32Array(stormCount * 3);
    const stormSeeds = new Float32Array(stormCount * 3);
    for (let i = 0; i < stormCount; i++) {
      stormPositions[i * 3] = (Math.random() - 0.5) * 230;
      stormPositions[i * 3 + 1] = Math.random() * 48;
      stormPositions[i * 3 + 2] = (Math.random() - 0.5) * 230;

      stormSeeds[i * 3] = 0.5 + Math.random() * 1.6; // wind speed factor
      stormSeeds[i * 3 + 1] = 8.0 + Math.random() * 24.0; // base size
      stormSeeds[i * 3 + 2] = Math.random() * Math.PI * 2; // turbulence phase
    }
    stormGeo.setAttribute('position', new THREE.BufferAttribute(stormPositions, 3));
    stormGeo.setAttribute('aSeed', new THREE.BufferAttribute(stormSeeds, 3));
    this.geometries.push(stormGeo);

    this.sandstormMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.55 },
        uMap: { value: textures.particleSprite },
        uColor: { value: new THREE.Color('#e2b67c') },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uIntensity;
        varying float vAlpha;

        void main() {
          vec3 pos = position;
          float speed = aSeed.x * (9.0 + uIntensity * 26.0);
          pos.x = mod(pos.x + uTime * speed + 115.0, 230.0) - 115.0;
          pos.z = mod(pos.z + uTime * speed * 0.35 + 115.0, 230.0) - 115.0;
          pos.y += sin(uTime * 1.4 + aSeed.z + pos.x * 0.04) * (1.2 + uIntensity * 2.4);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float dist = length(mvPosition.xyz);
          gl_PointSize = aSeed.y * (0.7 + uIntensity * 0.85) * (150.0 / max(dist, 12.0));
          gl_PointSize = clamp(gl_PointSize, 2.0, 64.0);

          float edgeFade = 1.0 - smoothstep(75.0, 120.0, length(pos.xz));
          vAlpha = edgeFade * (0.12 + uIntensity * 0.38);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float a = tex.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor * tex.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.materials.push(this.sandstormMat);
    this.sandstormPoints = new THREE.Points(stormGeo, this.sandstormMat);
    this.sandstormPoints.frustumCulled = false;
    this.root.add(this.sandstormPoints);

    // ------------------------------------------------------------------
    // 6. ACTIVE BREACH SAND ERUPTION PARTICLES
    // ------------------------------------------------------------------
    this.eruptionPositions = new Float32Array(this.eruptionCount * 3);
    this.eruptionVelocities = new Float32Array(this.eruptionCount * 3);
    this.eruptionLifetimes = new Float32Array(this.eruptionCount);
    for (let i = 0; i < this.eruptionCount; i++) {
      this.eruptionPositions[i * 3 + 1] = -999;
      this.eruptionLifetimes[i] = Math.random() * 2.2;
    }
    this.eruptionGeo = new THREE.BufferGeometry();
    this.eruptionGeo.setAttribute('position', new THREE.BufferAttribute(this.eruptionPositions, 3));
    this.geometries.push(this.eruptionGeo);

    this.eruptionMat = new THREE.PointsMaterial({
      color: new THREE.Color('#d6a468'),
      map: textures.particleSprite,
      size: 4.8,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.materials.push(this.eruptionMat);
    this.eruptionPoints = new THREE.Points(this.eruptionGeo, this.eruptionMat);
    this.eruptionPoints.frustumCulled = false;
    this.root.add(this.eruptionPoints);

    // ------------------------------------------------------------------
    // 7. ENGINEERING SPATIAL CALIBRATION GRID
    // ------------------------------------------------------------------
    this.buildEngineeringGrid();
    this.engineeringGridGroup.visible = false;
    this.root.add(this.engineeringGridGroup);

    this.applySunPosition(initial.sunElevationDeg, initial.sunAzimuthDeg);
  }

  private buildIndustrialInstallations(textures: ProceduralTextureSet, enableShadows: boolean): void {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9c8b76'),
      roughness: 0.92,
      metalness: 0.06,
    });
    const rustSteelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5c4a3d'),
      map: textures.gunmetalMap,
      roughness: 0.72,
      metalness: 0.62,
    });
    const weatheredArmorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6e7378'),
      map: textures.titaniumMap,
      roughness: 0.56,
      metalness: 0.74,
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c2a3f'),
      roughness: 0.22,
      metalness: 0.85,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c88228'),
      roughness: 0.62,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff8a1f'),
      emissive: new THREE.Color('#ff6600'),
      emissiveIntensity: 2.5,
      toneMapped: false,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.materials.push(
      concreteMat,
      rustSteelMat,
      weatheredArmorMat,
      solarPanelMat,
      hazardMat,
      this.beaconMat,
      shadowMat,
    );

    // --- INSTALLATION 1: Abandoned Seismic Monitoring Watchtower (8 composite parts) ---
    const tower = new THREE.Group();
    const tx = -48;
    const tz = 18;
    const ty = getTerrainHeight(tx, tz);
    tower.position.set(tx, ty - 0.4, tz);
    tower.rotation.y = 0.52;

    const plinthGeo = new THREE.CylinderGeometry(4.2, 5.8, 3.2, 8);
    const legGeo = new THREE.CylinderGeometry(0.28, 0.42, 16.5, 6);
    const deckGeo = new THREE.BoxGeometry(6.8, 0.7, 6.8);
    const cabinGeo = new THREE.BoxGeometry(4.6, 3.4, 4.2);
    const dishPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(1.4, 0.28),
      new THREE.Vector2(2.6, 0.95),
      new THREE.Vector2(3.1, 1.45),
    ];
    const dishGeo = new THREE.LatheGeometry(dishPts, 18);
    const solarGeo = new THREE.BoxGeometry(6.4, 0.14, 2.2);
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6);
    const beaconGeo = new THREE.SphereGeometry(0.32, 10, 10);
    const shadowGeo = new THREE.PlaneGeometry(16, 16);
    shadowGeo.rotateX(-Math.PI * 0.5);
    this.geometries.push(
      plinthGeo,
      legGeo,
      deckGeo,
      cabinGeo,
      dishGeo,
      solarGeo,
      mastGeo,
      beaconGeo,
      shadowGeo,
    );

    const plinth = new THREE.Mesh(plinthGeo, concreteMat);
    plinth.position.y = 1.2;
    plinth.castShadow = enableShadows;
    plinth.receiveShadow = enableShadows;
    tower.add(plinth);

    const legOffsets = [
      [-2.4, -2.4],
      [2.4, -2.4],
      [-2.4, 2.4],
      [2.4, 2.4],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, rustSteelMat);
      leg.position.set(lx, 9.6, lz);
      leg.rotation.z = lx > 0 ? 0.08 : -0.08;
      leg.rotation.x = lz > 0 ? -0.08 : 0.08;
      leg.castShadow = enableShadows;
      tower.add(leg);
    }

    const deck = new THREE.Mesh(deckGeo, weatheredArmorMat);
    deck.position.y = 17.6;
    deck.castShadow = enableShadows;
    tower.add(deck);

    const cabin = new THREE.Mesh(cabinGeo, weatheredArmorMat);
    cabin.position.set(0, 19.6, -0.4);
    cabin.castShadow = enableShadows;
    tower.add(cabin);

    const solar = new THREE.Mesh(solarGeo, solarPanelMat);
    solar.position.set(-5.2, 18.2, 0);
    solar.rotation.x = 0.42;
    tower.add(solar);

    const dishPivot = new THREE.Group();
    dishPivot.position.set(1.6, 22.0, 0.4);
    const dish = new THREE.Mesh(dishGeo, hazardMat);
    dish.rotation.x = Math.PI * 0.36;
    dishPivot.add(dish);
    tower.add(dishPivot);
    this.radarDish = dishPivot;

    const mast = new THREE.Mesh(mastGeo, rustSteelMat);
    mast.position.set(-1.6, 24.4, -1.2);
    tower.add(mast);

    const beacon = new THREE.Mesh(beaconGeo, this.beaconMat);
    beacon.position.set(-1.6, 28.2, -1.2);
    tower.add(beacon);

    const towerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    towerShadow.position.y = 0.48;
    tower.add(towerShadow);

    this.outpostsGroup.add(tower);

    // --- INSTALLATION 2: Half-Buried Research Bunker & Silos (7 composite parts) ---
    const bunker = new THREE.Group();
    const bx = 54;
    const bz = -24;
    const by = getTerrainHeight(bx, bz);
    bunker.position.set(bx, by - 1.1, bz);
    bunker.rotation.y = -0.82;
    bunker.rotation.z = 0.08; // slightly tilted by shifting dunes

    const hullGeo = new THREE.BoxGeometry(16, 6.5, 11.5);
    const roofGeo = new THREE.CylinderGeometry(5.8, 7.6, 15.2, 6);
    roofGeo.rotateZ(Math.PI * 0.5);
    const doorGeo = new THREE.BoxGeometry(4.4, 3.8, 1.2);
    const siloGeo = new THREE.CylinderGeometry(2.3, 2.3, 9.5, 14);
    const stackGeo = new THREE.CylinderGeometry(0.65, 0.85, 12, 10);
    this.geometries.push(hullGeo, roofGeo, doorGeo, siloGeo, stackGeo);

    const hull = new THREE.Mesh(hullGeo, concreteMat);
    hull.position.y = 2.8;
    hull.castShadow = enableShadows;
    hull.receiveShadow = enableShadows;
    bunker.add(hull);

    const roof = new THREE.Mesh(roofGeo, weatheredArmorMat);
    roof.position.y = 5.4;
    roof.scale.set(1, 0.55, 1);
    roof.castShadow = enableShadows;
    bunker.add(roof);

    const door = new THREE.Mesh(doorGeo, rustSteelMat);
    door.position.set(0, 2.6, 5.7);
    bunker.add(door);

    for (const sx of [-9.4, -14.2]) {
      const silo = new THREE.Mesh(siloGeo, weatheredArmorMat);
      silo.position.set(sx, 4.2, -1.5);
      silo.castShadow = enableShadows;
      bunker.add(silo);
    }

    for (const ex of [3.5, 5.6]) {
      const stack = new THREE.Mesh(stackGeo, rustSteelMat);
      stack.position.set(ex, 8.2, -3.2);
      stack.castShadow = enableShadows;
      bunker.add(stack);
    }

    this.outpostsGroup.add(bunker);

    // --- INSTALLATION 3: Three Desert Seismic Thumper Pylons ---
    const thumperCoords: Array<[number, number]> = [
      [34, 34],
      [-26, -46],
      [66, 22],
    ];
    const baseGeo = new THREE.CylinderGeometry(1.1, 1.8, 1.4, 6);
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.55, 6.2, 8);
    const capGeo = new THREE.BoxGeometry(1.4, 0.9, 1.4);
    this.geometries.push(baseGeo, bodyGeo, capGeo);

    for (const [px, pz] of thumperCoords) {
      const thumper = new THREE.Group();
      const py = getTerrainHeight(px, pz);
      thumper.position.set(px, py - 0.25, pz);

      const base = new THREE.Mesh(baseGeo, concreteMat);
      base.position.y = 0.6;
      thumper.add(base);

      const column = new THREE.Mesh(bodyGeo, hazardMat);
      column.position.y = 3.6;
      column.castShadow = enableShadows;
      thumper.add(column);

      const hammer = new THREE.Mesh(capGeo, rustSteelMat);
      hammer.position.y = 6.9;
      thumper.add(hammer);
      this.thumperPistons.push(hammer);

      this.outpostsGroup.add(thumper);
    }
  }

  private buildRockOutcrops(enableShadows: boolean): void {
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    // Flatten base & roughen vertices for desert-eroded sandstone strata
    const pos = rockGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const strata = 1.0 + Math.sin(y * 7.5) * 0.14 + Math.cos(x * 4.2 + z * 3.8) * 0.12;
      pos.setXYZ(i, x * strata * 1.35, Math.max(-0.45, y) * 0.95, z * strata * 1.15);
    }
    rockGeo.computeVertexNormals();
    this.geometries.push(rockGeo);

    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b08256'),
      roughness: 0.94,
      metalness: 0.04,
    });
    this.materials.push(rockMat);

    const rockCount = 46;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = enableShadows;
    rocks.receiveShadow = enableShadows;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < rockCount; i++) {
      // Ring of distant perimeter outcrops framing the dunes (radius 68m - 175m)
      const angle = (i / rockCount) * Math.PI * 2 + ((i * 19) % 10) * 0.06;
      const radius = 68 + ((i * 53) % 105);
      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = getTerrainHeight(rx, rz);

      const sx = 3.2 + ((i * 17) % 11) * 1.05;
      const sy = 2.4 + ((i * 29) % 9) * 1.15;
      const sz = 3.0 + ((i * 13) % 10) * 0.95;

      dummy.position.set(rx, ry + sy * 0.25, rz);
      dummy.rotation.set(0.08 * Math.sin(i), angle + i * 0.7, 0.06 * Math.cos(i));
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);

      const tint = 0.8 + ((i * 23) % 10) * 0.038;
      color.setRGB(tint, tint * 0.92, tint * 0.84);
      rocks.setColorAt(i, color);
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();

    this.outpostsGroup.add(rocks);
  }

  private buildEngineeringGrid(): void {
    const gridMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#f59e0b'),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.materials.push(gridMat);

    // Concentric range measurement rings conforming gently above the center arena
    const radii = [18, 36, 56, 80];
    for (const r of radii) {
      const pts: THREE.Vector3[] = [];
      const segs = 72;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.35, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.geometries.push(geo);
      this.engineeringGridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Radial engineering azimuth axes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let step = 8; step <= 80; step += 4) {
        const x = Math.cos(a) * step;
        const z = Math.sin(a) * step;
        pts.push(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.35, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.geometries.push(geo);
      this.engineeringGridGroup.add(new THREE.Line(geo, gridMat));
    }
  }

  private applySunPosition(elevDeg: number, azimDeg: number): void {
    const phi = THREE.MathUtils.degToRad(90 - elevDeg);
    const theta = THREE.MathUtils.degToRad(azimDeg);
    _sunDir.setFromSphericalCoords(1, phi, theta);

    this.sunLight.position.copy(_sunDir).multiplyScalar(155);
    this.skyMat.uniforms.uSunDir.value.copy(_sunDir);

    // Aim volumetric light shafts subtly from the sun toward the arena
    this.godRaysGroup.rotation.set(0, theta, -(Math.PI * 0.5 - phi) * 0.55);
  }

  public update(
    delta: number,
    elapsed: number,
    settings: EnvironmentSettings,
    showEngineeringGrid: boolean,
    breachPoints: THREE.Vector3[],
    activityFactor: number,
    renderer: THREE.WebGLRenderer,
  ): void {
    const dt = Math.min(delta, 0.08);
    const target = TOD_PALETTES[settings.timeOfDay];

    // Smoothly transition Time of Day lighting, sky, sun elevation, and fog
    const dampRate = 3.2;
    this.currentSunElev = THREE.MathUtils.damp(this.currentSunElev, target.sunElevationDeg, dampRate, dt);
    this.currentSunAzim = THREE.MathUtils.damp(this.currentSunAzim, target.sunAzimuthDeg, dampRate, dt);
    this.applySunPosition(this.currentSunElev, this.currentSunAzim);

    this.sunLight.color.lerp(target.sunColor, 1 - Math.exp(-dampRate * dt));
    this.sunLight.intensity = THREE.MathUtils.damp(this.sunLight.intensity, target.sunIntensity, dampRate, dt);

    this.hemiLight.color.lerp(target.hemiSky, 1 - Math.exp(-dampRate * dt));
    this.hemiLight.groundColor.lerp(target.hemiGround, 1 - Math.exp(-dampRate * dt));
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, target.hemiIntensity, dampRate, dt);

    this.rimLight.color.lerp(target.rimColor, 1 - Math.exp(-dampRate * dt));
    this.rimLight.intensity = THREE.MathUtils.damp(this.rimLight.intensity, target.rimIntensity, dampRate, dt);

    this.skyMat.uniforms.uZenithColor.value.lerp(target.zenithColor, 1 - Math.exp(-dampRate * dt));
    this.skyMat.uniforms.uHorizonColor.value.lerp(target.horizonColor, 1 - Math.exp(-dampRate * dt));
    this.skyMat.uniforms.uSunColor.value.lerp(target.sunColor, 1 - Math.exp(-dampRate * dt));
    this.skyMat.uniforms.uStarIntensity.value = THREE.MathUtils.damp(
      this.skyMat.uniforms.uStarIntensity.value,
      target.starIntensity,
      dampRate,
      dt,
    );
    this.skyMat.uniforms.uTime.value = elapsed;

    // Match fog density to atmospheric fog toggle + sandstorm intensity
    const stormFogBoost = settings.sandstormEnabled ? settings.sandstormIntensity * 0.0042 : 0;
    const desiredFogDensity = settings.atmosphericFog ? target.fogDensity + stormFogBoost : 0.0004;
    this.currentFogDensity = THREE.MathUtils.damp(this.currentFogDensity, desiredFogDensity, dampRate, dt);
    this.fog.density = this.currentFogDensity;
    this.fog.color.lerp(target.fogColor, 1 - Math.exp(-dampRate * dt));
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.fog.color);
    }

    this.currentExposure = THREE.MathUtils.damp(this.currentExposure, target.exposure, dampRate, dt);
    renderer.toneMappingExposure = this.currentExposure;

    // Volumetric sun shafts
    this.godRaysGroup.visible = settings.volumetricLighting;
    this.godRayMat.uniforms.uColor.value.copy(this.sunLight.color);
    this.godRayMat.uniforms.uOpacity.value =
      target.godRayOpacity * (0.7 + (settings.sandstormEnabled ? settings.sandstormIntensity * 0.6 : 0));
    this.godRayMat.uniforms.uTime.value = elapsed;

    // Outposts & animated desert machinery
    this.outpostsGroup.visible = settings.outpostStructures;
    if (this.radarDish) {
      this.radarDish.rotation.y = elapsed * 0.42;
    }
    for (let i = 0; i < this.thumperPistons.length; i++) {
      // Rhythmic acoustic desert thumper cadence
      const cycle = (elapsed * 1.15 + i * 0.9) % 1.0;
      const slam = cycle < 0.2 ? Math.pow(cycle / 0.2, 2) * 0.85 : (1 - (cycle - 0.2) / 0.8) * 0.85;
      this.thumperPistons[i].position.y = 6.9 - slam;
    }
    if (this.beaconMat) {
      this.beaconMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 3.1) * 1.1;
    }

    // Real-time terrain sand displacement shader uniforms
    if (this.terrainUniforms) {
      for (let i = 0; i < 12; i++) {
        this.terrainUniforms.uBreachPoints.value[i].copy(breachPoints[i]);
      }
      this.terrainUniforms.uDisplaceStrength.value = settings.sandDisplacement ? 1.0 : 0.0;
      this.terrainUniforms.uTime.value = elapsed;
    }

    // Dynamic sandstorm particles
    this.sandstormPoints.visible = settings.sandstormEnabled && settings.sandstormIntensity > 0.02;
    this.sandstormMat.uniforms.uTime.value = elapsed;
    this.sandstormMat.uniforms.uIntensity.value = settings.sandstormIntensity;
    _tmpColor.copy(this.fog.color).lerp(this.sunLight.color, 0.35);
    this.sandstormMat.uniforms.uColor.value.copy(_tmpColor);

    // Active Breach Sand Eruption Fountain
    const showEruption = settings.sandDisplacement;
    this.eruptionPoints.visible = showEruption;
    if (showEruption) {
      this.eruptionMat.color.copy(_tmpColor);
      let activeCount = 0;
      for (let i = 0; i < breachPoints.length; i++) {
        if (breachPoints[i].x < 5000) activeCount++;
      }

      for (let i = 0; i < this.eruptionCount; i++) {
        this.eruptionLifetimes[i] -= dt * (0.75 + activityFactor * 0.55);
        const i3 = i * 3;
        if (this.eruptionLifetimes[i] <= 0 && activeCount > 0) {
          const bp = breachPoints[i % activeCount];
          const angle = Math.random() * Math.PI * 2;
          const r = 3.2 + Math.random() * 5.2;
          this.eruptionPositions[i3] = bp.x + Math.cos(angle) * r;
          this.eruptionPositions[i3 + 1] = bp.y + 0.5 + Math.random() * 2.5;
          this.eruptionPositions[i3 + 2] = bp.z + Math.sin(angle) * r;

          const burst = 6.0 + activityFactor * 11.0;
          this.eruptionVelocities[i3] = Math.cos(angle) * (3.5 + Math.random() * 7.5);
          this.eruptionVelocities[i3 + 1] = burst * (0.55 + Math.random() * 0.85);
          this.eruptionVelocities[i3 + 2] = Math.sin(angle) * (3.5 + Math.random() * 7.5);
          this.eruptionLifetimes[i] = 1.1 + Math.random() * 1.4;
        } else {
          this.eruptionVelocities[i3 + 1] -= 14.5 * dt; // desert gravity
          this.eruptionPositions[i3] += this.eruptionVelocities[i3] * dt;
          this.eruptionPositions[i3 + 1] += this.eruptionVelocities[i3 + 1] * dt;
          this.eruptionPositions[i3 + 2] += this.eruptionVelocities[i3 + 2] * dt;
        }
      }
      this.eruptionGeo.attributes.position.needsUpdate = true;
    }

    // Engineering calibration grid
    this.engineeringGridGroup.visible = showEngineeringGrid;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
