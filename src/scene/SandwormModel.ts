import * as THREE from 'three';
import { getSegmentRadius, TOTAL_SEGMENTS } from '../types/sandwraith';
import type { SandwormMaterialLibrary } from './SandwormMaterials';

export interface SegmentPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radius: number;
  curvature: number;
}

// Reusable math objects (zero GC allocations inside render loop)
const _mat = new THREE.Matrix4();
const _matLocal = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _quat2 = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _axisZ = new THREE.Vector3(0, 0, 1);

function createArmorArcPlateGeometry(
  arcSpanRad: number,
  innerR: number,
  outerR: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const halfArc = arcSpanRad * 0.5;
  const steps = 10;

  // Outer faceted armored contour with slight center ridge
  for (let i = 0; i <= steps; i++) {
    const a = -halfArc + (arcSpanRad * i) / steps;
    const ridgeBoost = Math.cos((a / halfArc) * Math.PI * 0.5) * 0.08;
    const r = outerR + ridgeBoost;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  // Inner concave contour
  for (let i = steps; i >= 0; i--) {
    const a = -halfArc + (arcSpanRad * i) / steps;
    const x = Math.cos(a) * innerR;
    const y = Math.sin(a) * innerR;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.032,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createDorsalCrestGeometry(): THREE.ExtrudeGeometry {
  // Iconic heavy Dune-meets-aerospace dorsal spine crest plate with layered fins
  const shape = new THREE.Shape();
  shape.moveTo(-0.46, 0.88);
  shape.lineTo(-0.34, 1.15);
  shape.lineTo(-0.14, 1.24);
  shape.lineTo(0.0, 1.36);
  shape.lineTo(0.14, 1.24);
  shape.lineTo(0.34, 1.15);
  shape.lineTo(0.46, 0.88);
  shape.lineTo(0.28, 0.82);
  shape.lineTo(0.0, 0.86);
  shape.lineTo(-0.28, 0.82);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.96,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.48);
  geo.computeVertexNormals();
  return geo;
}

function createBulkheadRingGeometry(): THREE.LatheGeometry {
  // Lathe revolves around Y axis; we rotate to align along Z axis
  const pts = [
    new THREE.Vector2(0.58, -0.52),
    new THREE.Vector2(0.84, -0.48),
    new THREE.Vector2(0.92, -0.34),
    new THREE.Vector2(0.86, -0.14),
    new THREE.Vector2(0.76, -0.06),
    new THREE.Vector2(0.76, 0.06),
    new THREE.Vector2(0.86, 0.14),
    new THREE.Vector2(0.94, 0.34),
    new THREE.Vector2(0.85, 0.48),
    new THREE.Vector2(0.58, 0.52),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createSpurGearGeometry(teeth = 12, outerR = 0.72, rootR = 0.56, holeR = 0.28): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.62;
    const a4 = a0 + step * 0.74;

    const p0x = Math.cos(a0) * rootR;
    const p0y = Math.sin(a0) * rootR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.11);
  geo.computeVertexNormals();
  return geo;
}

function createCrusherFangGeometry(): THREE.ExtrudeGeometry {
  // Curved serrated tungsten crusher tooth
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0.0);
  shape.lineTo(0.34, 0.0);
  shape.lineTo(0.24, 1.25);
  shape.lineTo(0.14, 2.1);
  shape.lineTo(0.0, 3.05);
  shape.lineTo(-0.18, 2.0);
  shape.lineTo(-0.28, 1.15);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.13);
  geo.computeVertexNormals();
  return geo;
}

function createMandibleBladeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.lineTo(1.6, -0.52);
  shape.lineTo(3.4, -0.25);
  shape.lineTo(4.9, 0.48);
  shape.lineTo(5.6, 1.25);
  shape.lineTo(4.6, 1.05);
  shape.lineTo(3.1, 0.45);
  shape.lineTo(1.4, 0.35);
  shape.lineTo(0, 0.48);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.65,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.325);
  geo.computeVertexNormals();
  return geo;
}

function createCowlPetalGeometry(): THREE.ExtrudeGeometry {
  // Heavy flared jaw hood shield petal
  const shape = new THREE.Shape();
  shape.moveTo(-1.85, 0.0);
  shape.lineTo(1.85, 0.0);
  shape.lineTo(2.15, 2.8);
  shape.lineTo(1.55, 5.4);
  shape.lineTo(0.65, 6.75);
  shape.lineTo(-0.65, 6.75);
  shape.lineTo(-1.55, 5.4);
  shape.lineTo(-2.15, 2.8);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.34);
  geo.computeVertexNormals();
  return geo;
}

export class SandwormModel {
  public readonly root = new THREE.Group();
  public readonly raycastProxyMesh: THREE.InstancedMesh;
  public readonly headGroup = new THREE.Group();
  public readonly tailGroup = new THREE.Group();
  public readonly mawLight: THREE.PointLight;

  // Instanced structural layers across all 180 segments
  private readonly dorsalCrestMesh: THREE.InstancedMesh;
  private readonly portArmorMesh: THREE.InstancedMesh;
  private readonly starboardArmorMesh: THREE.InstancedMesh;
  private readonly ventralArmorMesh: THREE.InstancedMesh;
  private readonly bulkheadMesh: THREE.InstancedMesh;
  private readonly plasmaCoreMesh: THREE.InstancedMesh;
  private readonly hydraulicCylinderMesh: THREE.InstancedMesh;
  private readonly hydraulicRodMesh: THREE.InstancedMesh;
  private readonly copperPipeMesh: THREE.InstancedMesh;
  private readonly internalGearMesh: THREE.InstancedMesh;
  private readonly sensorFinMesh: THREE.InstancedMesh;
  private readonly heatShimmerMesh: THREE.InstancedMesh;

  // Articulated Head/Maw Sub-Assemblies
  private readonly cowlPivots: THREE.Group[] = [];
  private readonly mandiblePivots: THREE.Group[] = [];
  private readonly outerToothPivots: THREE.Group[] = [];
  private readonly middleGrinderRing = new THREE.Group();
  private readonly innerToothRing = new THREE.Group();
  private readonly internalTurbine = new THREE.Group();
  private readonly sensorScanBeams: THREE.Mesh[] = [];

  // Selection inspection reticle
  private readonly selectionReticle: THREE.Group;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly extraMaterials: THREE.Material[] = [];

  private readonly sensorSegmentIndices: number[] = [];
  private readonly shimmerSegmentIndices: number[] = [];

  constructor(
    private readonly materials: SandwormMaterialLibrary,
    isSoftwareGl: boolean,
  ) {
    this.root.name = 'SandwraithAssembly';

    // ------------------------------------------------------------------
    // 1. BODY INSTANCED GEOMETRIES (180 Articulated Segments)
    // ------------------------------------------------------------------
    const dorsalGeo = createDorsalCrestGeometry();
    const flankArcGeo = createArmorArcPlateGeometry(Math.PI * 0.44, 0.89, 1.07, 1.12);
    const ventralArcGeo = createArmorArcPlateGeometry(Math.PI * 0.56, 0.87, 1.02, 1.08);
    const bulkheadGeo = createBulkheadRingGeometry();
    const coreTorusGeo = new THREE.TorusGeometry(0.79, 0.085, 10, 24);
    const cylinderGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.82, 8);
    cylinderGeo.rotateX(Math.PI * 0.5);
    const rodGeo = new THREE.CylinderGeometry(0.048, 0.048, 1.12, 8);
    rodGeo.rotateX(Math.PI * 0.5);
    const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.32, 6);
    pipeGeo.rotateX(Math.PI * 0.5);
    const gearGeo = createSpurGearGeometry(14, 0.72, 0.56, 0.28);
    const sensorFinGeo = new THREE.BoxGeometry(0.24, 0.42, 0.52);
    const shimmerGeo = new THREE.TorusGeometry(0.95, 0.24, 10, 20);
    const proxyGeo = new THREE.CylinderGeometry(1.12, 1.12, 1.38, 10);
    proxyGeo.rotateX(Math.PI * 0.5);

    this.geometries.push(
      dorsalGeo,
      flankArcGeo,
      ventralArcGeo,
      bulkheadGeo,
      coreTorusGeo,
      cylinderGeo,
      rodGeo,
      pipeGeo,
      gearGeo,
      sensorFinGeo,
      shimmerGeo,
      proxyGeo,
    );

    // Every 4th segment gets a dorsal sensor fin; every 3rd gets a heat shimmer shell
    for (let i = 3; i < TOTAL_SEGMENTS - 3; i += 4) {
      this.sensorSegmentIndices.push(i);
    }
    for (let i = 1; i < TOTAL_SEGMENTS - 4; i += 3) {
      this.shimmerSegmentIndices.push(i);
    }

    const bodyCount = TOTAL_SEGMENTS;
    const pistonsPerSeg = 4;
    const pipesPerSeg = 2;

    this.dorsalCrestMesh = this.makeInstanced(dorsalGeo, materials.titaniumCrest, bodyCount, true, !isSoftwareGl);
    this.portArmorMesh = this.makeInstanced(flankArcGeo, materials.titaniumArmor, bodyCount, true, !isSoftwareGl);
    this.starboardArmorMesh = this.makeInstanced(flankArcGeo, materials.titaniumArmor, bodyCount, true, !isSoftwareGl);
    this.ventralArmorMesh = this.makeInstanced(ventralArcGeo, materials.titaniumCrest, bodyCount, false, !isSoftwareGl);
    this.bulkheadMesh = this.makeInstanced(bulkheadGeo, materials.gunmetalChassis, bodyCount, true, !isSoftwareGl);
    this.plasmaCoreMesh = this.makeInstanced(coreTorusGeo, materials.plasmaCore, bodyCount, false, false);
    this.hydraulicCylinderMesh = this.makeInstanced(cylinderGeo, materials.gunmetalChassis, bodyCount * pistonsPerSeg, false, false);
    this.hydraulicRodMesh = this.makeInstanced(rodGeo, materials.hydraulicChrome, bodyCount * pistonsPerSeg, false, false);
    this.copperPipeMesh = this.makeInstanced(pipeGeo, materials.copperConduit, bodyCount * pipesPerSeg, false, false);
    this.internalGearMesh = this.makeInstanced(gearGeo, materials.internalGearSteel, bodyCount, false, false);
    this.sensorFinMesh = this.makeInstanced(sensorFinGeo, materials.sensorEmitter, this.sensorSegmentIndices.length, false, false);
    this.heatShimmerMesh = this.makeInstanced(shimmerGeo, materials.heatShimmer, this.shimmerSegmentIndices.length, false, false);

    // Subtle per-instance weathering tint variation across titanium armor plates
    const tintColor = new THREE.Color();
    for (let i = 0; i < bodyCount; i++) {
      const wear = 0.88 + (((i * 37) % 19) / 19) * 0.24;
      const desertDust = 0.94 + (((i * 13) % 11) / 11) * 0.1;
      tintColor.setRGB(wear * desertDust, wear * 0.98, wear * 0.94);
      this.portArmorMesh.setColorAt(i, tintColor);
      this.starboardArmorMesh.setColorAt(i, tintColor);
      tintColor.setRGB(wear * 0.92, wear * 0.9, wear * 0.88);
      this.dorsalCrestMesh.setColorAt(i, tintColor);
    }
    if (this.portArmorMesh.instanceColor) this.portArmorMesh.instanceColor.needsUpdate = true;
    if (this.starboardArmorMesh.instanceColor) this.starboardArmorMesh.instanceColor.needsUpdate = true;
    if (this.dorsalCrestMesh.instanceColor) this.dorsalCrestMesh.instanceColor.needsUpdate = true;

    // Invisible zero-pixel-cost raycast proxy mesh on Layer 1
    const proxyMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.0,
    });
    this.extraMaterials.push(proxyMat);
    this.raycastProxyMesh = new THREE.InstancedMesh(proxyGeo, proxyMat, bodyCount);
    this.raycastProxyMesh.frustumCulled = false;
    this.raycastProxyMesh.layers.set(1);
    this.raycastProxyMesh.name = 'SandwormSegmentProxies';
    this.root.add(this.raycastProxyMesh);

    // ------------------------------------------------------------------
    // 2. HERO HEAD & CIRCULAR MECHANICAL JAW ASSEMBLY
    // ------------------------------------------------------------------
    this.mawLight = new THREE.PointLight('#ff6a14', 65, 58, 1.6);
    this.mawLight.position.set(0, 0, 3.2);
    this.buildHeadAssembly(!isSoftwareGl);
    this.root.add(this.headGroup);

    // ------------------------------------------------------------------
    // 3. TAIL EXHAUST & BALLAST THRUSTER ASSEMBLY
    // ------------------------------------------------------------------
    this.buildTailAssembly(!isSoftwareGl);
    this.root.add(this.tailGroup);

    // ------------------------------------------------------------------
    // 4. SEGMENT INSPECTION RETICLE
    // ------------------------------------------------------------------
    this.selectionReticle = this.buildSelectionReticle();
    this.selectionReticle.visible = false;
    this.root.add(this.selectionReticle);
  }

  private makeInstanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    castShadow: boolean,
    enableShadows: boolean,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = enableShadows && castShadow;
    mesh.receiveShadow = enableShadows;
    this.root.add(mesh);
    return mesh;
  }

  private buildHeadAssembly(enableShadows: boolean): void {
    const {
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
    } = this.materials;

    // A. Heavy armored throat casing bell (Lathe profile along +Z)
    const throatPts = [
      new THREE.Vector2(5.1, -1.6),
      new THREE.Vector2(5.75, -0.4),
      new THREE.Vector2(5.95, 1.4),
      new THREE.Vector2(5.6, 3.4),
      new THREE.Vector2(4.6, 4.1),
      new THREE.Vector2(3.7, 2.2),
      new THREE.Vector2(2.6, -0.5),
    ];
    const throatGeo = new THREE.LatheGeometry(throatPts, 28);
    throatGeo.rotateX(Math.PI * 0.5);
    this.geometries.push(throatGeo);
    const throatMesh = new THREE.Mesh(throatGeo, gunmetalChassis);
    throatMesh.castShadow = enableShadows;
    throatMesh.receiveShadow = enableShadows;
    this.headGroup.add(throatMesh);

    // Glowing furnace throat lining & heat distortion cone
    const furnaceRingGeo = new THREE.TorusGeometry(3.3, 0.42, 12, 28);
    const furnaceDiskGeo = new THREE.CylinderGeometry(2.5, 1.6, 1.2, 24);
    furnaceDiskGeo.rotateX(Math.PI * 0.5);
    const mawShimmerGeo = new THREE.CylinderGeometry(5.1, 3.6, 5.4, 20, 1, true);
    mawShimmerGeo.rotateX(Math.PI * 0.5);
    this.geometries.push(furnaceRingGeo, furnaceDiskGeo, mawShimmerGeo);

    const furnaceRing = new THREE.Mesh(furnaceRingGeo, plasmaCore);
    furnaceRing.position.z = 2.55;
    this.headGroup.add(furnaceRing);

    const furnaceBack = new THREE.Mesh(furnaceDiskGeo, furnaceCore);
    furnaceBack.position.z = 0.2;
    this.headGroup.add(furnaceBack);

    const mawShimmer = new THREE.Mesh(mawShimmerGeo, heatShimmer);
    mawShimmer.position.z = 4.5;
    this.headGroup.add(mawShimmer);

    this.headGroup.add(this.mawLight);

    // B. Internal Rotating Furnace Turbine
    const hubGeo = new THREE.CylinderGeometry(0.95, 1.25, 1.5, 16);
    hubGeo.rotateX(Math.PI * 0.5);
    const vaneGeo = new THREE.BoxGeometry(2.55, 0.16, 0.72);
    this.geometries.push(hubGeo, vaneGeo);

    const turbineHub = new THREE.Mesh(hubGeo, internalGearSteel);
    this.internalTurbine.add(turbineHub);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const vane = new THREE.Mesh(vaneGeo, copperConduit);
      vane.position.set(Math.cos(angle) * 1.65, Math.sin(angle) * 1.65, 0);
      vane.rotation.z = angle;
      vane.rotation.x = 0.42;
      this.internalTurbine.add(vane);
    }
    this.internalTurbine.position.z = 1.45;
    this.headGroup.add(this.internalTurbine);

    // C. Three Concentric Rings of Metallic Teeth
    const fangGeo = createCrusherFangGeometry();
    this.geometries.push(fangGeo);

    // Ring 1 (Outer): 18 colossal cantilevered crusher fangs that articulate with jaw aperture
    const outerToothCount = 18;
    for (let i = 0; i < outerToothCount; i++) {
      const angle = (i / outerToothCount) * Math.PI * 2;
      const anchor = new THREE.Group();
      anchor.position.set(Math.cos(angle) * 4.85, Math.sin(angle) * 4.85, 3.85);
      anchor.rotation.z = angle + Math.PI * 0.5; // local +Y points inward toward center

      const pivot = new THREE.Group();
      const fang = new THREE.Mesh(fangGeo, tungstenTeeth);
      fang.scale.set(0.92, 1.02, 0.92);
      fang.rotation.x = 0.55; // angled slightly forward
      fang.castShadow = enableShadows;
      pivot.add(fang);

      anchor.add(pivot);
      this.headGroup.add(anchor);
      this.outerToothPivots.push(pivot);
    }

    // Ring 2 (Middle): 14 counter-rotating industrial grinder blades on gear track
    const midTrackGeo = new THREE.TorusGeometry(4.05, 0.24, 10, 28);
    this.geometries.push(midTrackGeo);
    const midTrack = new THREE.Mesh(midTrackGeo, internalGearSteel);
    this.middleGrinderRing.add(midTrack);

    const midToothCount = 14;
    for (let i = 0; i < midToothCount; i++) {
      const angle = (i / midToothCount) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(angle) * 4.0, Math.sin(angle) * 4.0, 0);
      holder.rotation.z = angle + Math.PI * 0.5;
      const blade = new THREE.Mesh(fangGeo, tungstenTeeth);
      blade.scale.set(0.7, 0.78, 0.72);
      blade.rotation.x = 0.32;
      blade.rotation.y = 0.28;
      holder.add(blade);
      this.middleGrinderRing.add(holder);
    }
    this.middleGrinderRing.position.z = 2.95;
    this.headGroup.add(this.middleGrinderRing);

    // Ring 3 (Inner): 12 razor intake fangs guarding furnace throat
    const innerToothCount = 12;
    for (let i = 0; i < innerToothCount; i++) {
      const angle = (i / innerToothCount) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(angle) * 3.05, Math.sin(angle) * 3.05, 0);
      holder.rotation.z = angle + Math.PI * 0.5;
      const blade = new THREE.Mesh(fangGeo, tungstenTeeth);
      blade.scale.set(0.55, 0.62, 0.58);
      blade.rotation.x = 0.16;
      holder.add(blade);
      this.innerToothRing.add(holder);
    }
    this.innerToothRing.position.z = 2.05;
    this.headGroup.add(this.innerToothRing);

    // D. Six Heavy Articulated Titanium Cowl Petals + Hydraulic Actuators
    const petalGeo = createCowlPetalGeometry();
    const strutGeo = new THREE.CylinderGeometry(0.18, 0.22, 4.2, 8);
    const strutRodGeo = new THREE.CylinderGeometry(0.11, 0.11, 3.8, 8);
    this.geometries.push(petalGeo, strutGeo, strutRodGeo);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const anchor = new THREE.Group();
      anchor.position.set(Math.cos(angle) * 5.45, Math.sin(angle) * 5.45, 0.75);
      anchor.rotation.z = angle - Math.PI * 0.5;

      const pivot = new THREE.Group();

      // Main armored cowl shield oriented forward along +Z
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? titaniumArmor : titaniumCrest);
      petal.rotation.x = Math.PI * 0.5;
      petal.castShadow = enableShadows;
      petal.receiveShadow = enableShadows;
      pivot.add(petal);

      // Visible heavy chrome hydraulic ram pushing petal from underside
      const ram = new THREE.Mesh(strutRodGeo, hydraulicChrome);
      ram.position.set(0, -0.55, 2.3);
      ram.rotation.x = Math.PI * 0.5 - 0.18;
      pivot.add(ram);

      // Glowing amber vent strip inside each cowl
      const ventGeo = new THREE.BoxGeometry(1.1, 0.14, 2.4);
      this.geometries.push(ventGeo);
      const vent = new THREE.Mesh(ventGeo, plasmaCore);
      vent.position.set(0, -0.35, 3.3);
      pivot.add(vent);

      anchor.add(pivot);
      this.headGroup.add(anchor);
      this.cowlPivots.push(pivot);
    }

    // E. Four Heavy Articulated Mechanical Mandibles (Diagonals)
    const mandibleGeo = createMandibleBladeGeometry();
    const jointGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12);
    this.geometries.push(mandibleGeo, jointGeo);

    const mandibleAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      Math.PI * 1.25,
      Math.PI * 1.75,
    ];
    for (const angle of mandibleAngles) {
      const anchor = new THREE.Group();
      anchor.position.set(Math.cos(angle) * 5.7, Math.sin(angle) * 5.7, 2.65);
      anchor.rotation.z = angle;

      const pivot = new THREE.Group();
      const hinge = new THREE.Mesh(jointGeo, hydraulicChrome);
      hinge.rotation.x = Math.PI * 0.5;
      pivot.add(hinge);

      const blade = new THREE.Mesh(mandibleGeo, titaniumCrest);
      // Use ZYX order: Ry(-PI/2) maps +X length -> +Z forward, then Rz(+PI/2) maps +Y hook -> -X radially inward
      blade.rotation.order = 'ZYX';
      blade.rotation.set(0, -Math.PI * 0.5, Math.PI * 0.5);
      blade.position.set(0.15, 0, 0.35);
      blade.castShadow = enableShadows;
      pivot.add(blade);

      anchor.add(pivot);
      this.headGroup.add(anchor);
      this.mandiblePivots.push(pivot);
    }

    // F. Brow Optical & Seismic Sensor Arrays
    const podGeo = new THREE.BoxGeometry(1.55, 0.85, 2.35);
    const lensGeo = new THREE.SphereGeometry(0.36, 16, 12);
    const diodeGeo = new THREE.BoxGeometry(0.95, 0.12, 0.14);
    const beamGeo = new THREE.ConeGeometry(1.1, 8.5, 12, 1, true);
    beamGeo.rotateX(-Math.PI * 0.5);
    beamGeo.translate(0, 0, 4.25);
    this.geometries.push(podGeo, lensGeo, diodeGeo, beamGeo);

    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffaa33'),
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.extraMaterials.push(beamMat);

    const sensorAngles = [Math.PI * 0.5, Math.PI * 0.28, Math.PI * 0.72];
    for (const angle of sensorAngles) {
      const pod = new THREE.Group();
      pod.position.set(Math.cos(angle) * 6.05, Math.sin(angle) * 6.05, 0.2);
      pod.rotation.z = angle - Math.PI * 0.5;

      const housing = new THREE.Mesh(podGeo, gunmetalChassis);
      housing.castShadow = enableShadows;
      pod.add(housing);

      const lens = new THREE.Mesh(lensGeo, opticalLens);
      lens.position.set(0, 0.05, 1.15);
      pod.add(lens);

      const diode = new THREE.Mesh(diodeGeo, sensorEmitter);
      diode.position.set(0, 0.34, 1.18);
      pod.add(diode);

      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 0.05, 1.3);
      pod.add(beam);
      this.sensorScanBeams.push(beam);

      this.headGroup.add(pod);
    }
  }

  private buildTailAssembly(enableShadows: boolean): void {
    const { titaniumCrest, gunmetalChassis, plasmaCore, copperConduit } = this.materials;

    const conePts = [
      new THREE.Vector2(0.32, -4.4),
      new THREE.Vector2(0.45, -5.5),
      new THREE.Vector2(0.72, -5.2),
      new THREE.Vector2(1.05, -3.4),
      new THREE.Vector2(1.42, -1.2),
      new THREE.Vector2(1.55, 0.4),
    ];
    const coneGeo = new THREE.LatheGeometry(conePts, 18);
    coneGeo.rotateX(Math.PI * 0.5);
    const finGeo = new THREE.BoxGeometry(0.18, 1.45, 3.2);
    const nozzleGlowGeo = new THREE.TorusGeometry(0.54, 0.14, 10, 18);
    this.geometries.push(coneGeo, finGeo, nozzleGlowGeo);

    const shroud = new THREE.Mesh(coneGeo, gunmetalChassis);
    shroud.castShadow = enableShadows;
    this.tailGroup.add(shroud);

    const glow = new THREE.Mesh(nozzleGlowGeo, plasmaCore);
    glow.position.z = -5.15;
    this.tailGroup.add(glow);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fin = new THREE.Mesh(finGeo, i % 2 === 0 ? titaniumCrest : copperConduit);
      fin.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, -2.6);
      fin.rotation.z = a - Math.PI * 0.5;
      fin.rotation.x = 0.22;
      this.tailGroup.add(fin);
    }
  }

  private buildSelectionReticle(): THREE.Group {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.32, 0.055, 8, 36);
    const tickGeo = new THREE.BoxGeometry(0.08, 0.34, 0.08);
    this.geometries.push(ringGeo, tickGeo);

    const ring = new THREE.Mesh(ringGeo, this.materials.selectionHighlight);
    group.add(ring);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const tick = new THREE.Mesh(tickGeo, this.materials.selectionHighlight);
      tick.position.set(Math.cos(a) * 1.46, Math.sin(a) * 1.46, 0);
      tick.rotation.z = a - Math.PI * 0.5;
      group.add(tick);
    }
    return group;
  }

  /**
   * Synchronizes all 180 instanced segment layers, hydraulic pistons, rotating gears,
   * circular jaw petals/teeth, exploded-view offsets, and selection reticle.
   */
  public updateFromPoses(
    poses: SegmentPose[],
    elapsed: number,
    jawAperture: number,
    turbineAngle: number,
    explodedAmount: number,
    selectedSegmentIndex: number | null,
    heatShimmerEnabled: boolean,
  ): void {
    const explodeArmor = explodedAmount * 0.85; // radial multiplier
    const explodeHydraulic = explodedAmount * 0.42;

    let pistonIdx = 0;
    let pipeIdx = 0;
    let sensorIdx = 0;
    let shimmerIdx = 0;
    let nextSensorSeg = this.sensorSegmentIndices[0] ?? -1;
    let nextShimmerSeg = this.shimmerSegmentIndices[0] ?? -1;

    const pistonAngles = [Math.PI * 0.22, Math.PI * 0.78, Math.PI * 1.22, Math.PI * 1.78];

    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const pose = poses[i];
      const r = pose.radius;
      const isSelected = selectedSegmentIndex === i;
      const localExplode = explodeArmor + (isSelected && explodedAmount > 0.02 ? 0.24 : 0);

      // Base segment matrix (position + orientation + radial scale, Z-length uniform 1.0)
      _scale.set(r, r, 1.08);
      _mat.compose(pose.position, pose.quaternion, _scale);

      // 1. Bulkhead structural gunmetal chassis
      this.bulkheadMesh.setMatrixAt(i, _mat);

      // 2. Glowing plasma core ring (offset slightly aft into inter-segment joint)
      _offset.set(0, 0, -0.58);
      _matLocal.makeTranslation(_offset.x, _offset.y, _offset.z);
      _matLocal.premultiply(_mat);
      this.plasmaCoreMesh.setMatrixAt(i, _matLocal);

      // 3. Internal counter-rotating involute spur gear
      const gearDir = i % 2 === 0 ? 1 : -1;
      _quat.setFromAxisAngle(_axisZ, turbineAngle * 0.45 * gearDir + i * 0.35);
      _matLocal.compose(_pos.set(0, 0, 0.08), _quat, _scale.set(1, 1, 1));
      _matLocal.premultiply(_mat);
      this.internalGearMesh.setMatrixAt(i, _matLocal);

      // 4. Four Layered Titanium Armor Shells (radially explode outward in Exploded View!)
      // Dorsal Crest (+Y)
      _matLocal.makeTranslation(0, localExplode * 0.92, 0);
      _matLocal.premultiply(_mat);
      this.dorsalCrestMesh.setMatrixAt(i, _matLocal);

      // Port Upper/Mid Flank (+X side, centered around 0 rad)
      _quat.setFromAxisAngle(_axisZ, 0.12);
      _matLocal.compose(_pos.set(localExplode * 0.85, localExplode * 0.18, 0), _quat, _scale.set(1, 1, 1));
      _matLocal.premultiply(_mat);
      this.portArmorMesh.setMatrixAt(i, _matLocal);

      // Starboard Upper/Mid Flank (-X side, rotated PI)
      _quat.setFromAxisAngle(_axisZ, Math.PI - 0.12);
      _matLocal.compose(_pos.set(-localExplode * 0.85, localExplode * 0.18, 0), _quat, _scale.set(1, 1, 1));
      _matLocal.premultiply(_mat);
      this.starboardArmorMesh.setMatrixAt(i, _matLocal);

      // Ventral Skid Armor (-Y side, rotated -PI/2)
      _quat.setFromAxisAngle(_axisZ, -Math.PI * 0.5);
      _matLocal.compose(_pos.set(0, -localExplode * 0.78, 0), _quat, _scale.set(1, 1, 1));
      _matLocal.premultiply(_mat);
      this.ventralArmorMesh.setMatrixAt(i, _matLocal);

      // 5. Four Articulated Hydraulic Pistons per segment (extend/retract with curvature!)
      for (let p = 0; p < 4; p++) {
        const a = pistonAngles[p];
        const radialR = 0.86 + explodeHydraulic * 0.6;
        const px = Math.cos(a) * radialR;
        const py = Math.sin(a) * radialR;
        const stroke = Math.sin(elapsed * 2.5 + i * 0.28 + p) * 0.08 + pose.curvature * (p % 2 === 0 ? 0.12 : -0.12);

        _matLocal.makeTranslation(px, py, -0.22);
        _matLocal.premultiply(_mat);
        this.hydraulicCylinderMesh.setMatrixAt(pistonIdx, _matLocal);

        _matLocal.makeTranslation(px, py, 0.24 + stroke);
        _matLocal.premultiply(_mat);
        this.hydraulicRodMesh.setMatrixAt(pistonIdx, _matLocal);
        pistonIdx++;
      }

      // 6. Twin Exposed Copper Cooling Conduits
      for (let c = 0; c < 2; c++) {
        const side = c === 0 ? 1 : -1;
        _matLocal.makeTranslation(side * (0.76 + explodeHydraulic * 0.3), -0.35, 0);
        _matLocal.premultiply(_mat);
        this.copperPipeMesh.setMatrixAt(pipeIdx, _matLocal);
        pipeIdx++;
      }

      // 7. Periodic Dorsal Optical/Sensor Nodes
      if (i === nextSensorSeg) {
        _matLocal.makeTranslation(0, 1.32 + localExplode * 0.95, 0);
        _matLocal.premultiply(_mat);
        this.sensorFinMesh.setMatrixAt(sensorIdx, _matLocal);
        sensorIdx++;
        nextSensorSeg = this.sensorSegmentIndices[sensorIdx] ?? -1;
      }

      // 8. Periodic Heat Shimmer Shells
      if (i === nextShimmerSeg) {
        if (heatShimmerEnabled) {
          _matLocal.makeTranslation(0, 0, -0.58);
          _matLocal.premultiply(_mat);
          this.heatShimmerMesh.setMatrixAt(shimmerIdx, _matLocal);
        } else {
          _matLocal.makeScale(0, 0, 0);
          this.heatShimmerMesh.setMatrixAt(shimmerIdx, _matLocal);
        }
        shimmerIdx++;
        nextShimmerSeg = this.shimmerSegmentIndices[shimmerIdx] ?? -1;
      }

      // 9. Raycast proxy capsule (slightly larger than outer radius for effortless clicking)
      _scale.set(r * (1.05 + localExplode * 0.55), r * (1.05 + localExplode * 0.55), 1.0);
      _mat.compose(pose.position, pose.quaternion, _scale);
      this.raycastProxyMesh.setMatrixAt(i, _mat);
    }

    this.dorsalCrestMesh.instanceMatrix.needsUpdate = true;
    this.portArmorMesh.instanceMatrix.needsUpdate = true;
    this.starboardArmorMesh.instanceMatrix.needsUpdate = true;
    this.ventralArmorMesh.instanceMatrix.needsUpdate = true;
    this.bulkheadMesh.instanceMatrix.needsUpdate = true;
    this.plasmaCoreMesh.instanceMatrix.needsUpdate = true;
    this.hydraulicCylinderMesh.instanceMatrix.needsUpdate = true;
    this.hydraulicRodMesh.instanceMatrix.needsUpdate = true;
    this.copperPipeMesh.instanceMatrix.needsUpdate = true;
    this.internalGearMesh.instanceMatrix.needsUpdate = true;
    this.sensorFinMesh.instanceMatrix.needsUpdate = true;
    this.heatShimmerMesh.instanceMatrix.needsUpdate = true;
    this.raycastProxyMesh.instanceMatrix.needsUpdate = true;
    this.raycastProxyMesh.computeBoundingSphere();

    // ------------------------------------------------------------------
    // Update Hero Head & Concentric Mechanical Jaw Assembly
    // ------------------------------------------------------------------
    const headPose = poses[0];
    this.headGroup.position.copy(headPose.position);
    this.headGroup.quaternion.copy(headPose.quaternion);

    const cowlSpread = 0.08 + jawAperture * 0.68 + explodedAmount * 0.35;
    for (let i = 0; i < this.cowlPivots.length; i++) {
      const p = this.cowlPivots[i];
      p.rotation.x = -cowlSpread;
      p.position.y = explodedAmount * 1.6;
      p.position.z = explodedAmount * 0.8;
    }

    const mandibleFlare = 0.08 + jawAperture * 0.62 + explodedAmount * 0.32;
    for (let i = 0; i < this.mandiblePivots.length; i++) {
      const m = this.mandiblePivots[i];
      m.rotation.y = mandibleFlare;
      m.position.x = explodedAmount * 1.4;
    }

    // Concentric Teeth Rings — positive X rotation flares fangs forward & radially outward to expose furnace
    const toothOpen = jawAperture * 0.88 + explodedAmount * 0.25;
    for (let i = 0; i < this.outerToothPivots.length; i++) {
      this.outerToothPivots[i].rotation.x = toothOpen;
    }
    this.middleGrinderRing.rotation.z = turbineAngle * 1.4;
    this.innerToothRing.rotation.z = -turbineAngle * 2.1;
    this.internalTurbine.rotation.z = turbineAngle * 3.2;
    this.mawLight.intensity = 42 + jawAperture * 135;

    // Subtle optical scan sweep on brow sensors
    for (let i = 0; i < this.sensorScanBeams.length; i++) {
      this.sensorScanBeams[i].rotation.y = Math.sin(elapsed * 1.8 + i * 1.3) * 0.22;
    }

    // ------------------------------------------------------------------
    // Update Tail Exhaust Assembly
    // ------------------------------------------------------------------
    const tailPose = poses[TOTAL_SEGMENTS - 1];
    this.tailGroup.position.copy(tailPose.position);
    this.tailGroup.quaternion.copy(tailPose.quaternion);

    // ------------------------------------------------------------------
    // Update Inspection Selection Reticle
    // ------------------------------------------------------------------
    if (selectedSegmentIndex !== null && selectedSegmentIndex >= 0 && selectedSegmentIndex < TOTAL_SEGMENTS) {
      const sp = poses[selectedSegmentIndex];
      this.selectionReticle.visible = true;
      this.selectionReticle.position.copy(sp.position);
      this.selectionReticle.quaternion.copy(sp.quaternion);
      const rScale = sp.radius * (1.12 + explodedAmount * 0.65);
      this.selectionReticle.scale.setScalar(rScale);
      _quat2.setFromAxisAngle(_axisZ, elapsed * 0.6);
      this.selectionReticle.quaternion.multiply(_quat2);
    } else {
      this.selectionReticle.visible = false;
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.extraMaterials.forEach((m) => m.dispose());
  }
}
