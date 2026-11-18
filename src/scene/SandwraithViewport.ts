import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type {
  CameraPreset,
  SimulationConfig,
  TelemetryData,
} from '../types/sandwraith';
import { TOTAL_SEGMENTS } from '../types/sandwraith';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createSandwormMaterials, type SandwormMaterialLibrary } from './SandwormMaterials';
import { SandwormModel } from './SandwormModel';
import { SandwormKinematics } from './SandwormKinematics';
import { DesertEnvironment } from './DesertEnvironment';
import { SoundEngine } from './SoundEngine';

export interface ViewportCallbacks {
  onTelemetry: (telemetry: TelemetryData) => void;
  onSegmentSelect: (segmentIndex: number) => void;
  onSegmentHover: (segmentIndex: number | null) => void;
  onContextLost: (lost: boolean) => void;
}

const _camDesiredPos = new THREE.Vector3();
const _camDesiredTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _headForward = new THREE.Vector3();
const _headRight = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class SandwraithViewport {
  private readonly container: HTMLElement;
  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer | null = null;
  private readonly bloomPass: UnrealBloomPass | null = null;

  private readonly textures: ProceduralTextureSet;
  private readonly materials: SandwormMaterialLibrary;
  private readonly wormModel: SandwormModel;
  private readonly kinematics: SandwormKinematics;
  private readonly environment: DesertEnvironment;
  public readonly sound: SoundEngine;

  private readonly envRT: THREE.WebGLRenderTarget;
  private readonly raycaster = new THREE.Raycaster();

  private config: SimulationConfig;
  private readonly callbacks: ViewportCallbacks;

  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private elapsed = 0;
  private lastTelemetryEmit = 0;
  private lastHoverRaycast = 0;
  private pointerDownPos = { x: 0, y: 0 };

  // Smooth damped transitions
  private currentExploded = 0;
  private activeCameraTransition: CameraPreset | null = null;
  private lastCameraNonce = -1;
  private lastJawSurgeNonce = 0;
  private lastZoomNonce = 0;

  // Bound event listeners for clean removal
  private readonly handleResizeBound: () => void;
  private readonly handlePointerDownBound: (e: PointerEvent) => void;
  private readonly handlePointerUpBound: (e: PointerEvent) => void;
  private readonly handlePointerMoveBound: (e: PointerEvent) => void;
  private readonly handleContextLostBound: (e: Event) => void;
  private readonly handleContextRestoredBound: () => void;

  constructor(
    container: HTMLElement,
    initialConfig: SimulationConfig,
    callbacks: ViewportCallbacks,
  ) {
    this.container = container;
    this.config = initialConfig;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.sound = new SoundEngine();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    // 1. Renderer setup with modern color management & software-GL cost scaling
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Mandatory Studio RoomEnvironment IBL Reflections (all devices)
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // 3. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 900);
    this.camera.position.set(46, 22, 62);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 11;
    this.controls.maxDistance = 210;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.target.set(2, 13, 6);
    this.controls.update();

    // Immediately cancel scripted camera preset transitions when user interacts manually
    this.controls.addEventListener('start', () => {
      this.activeCameraTransition = null;
    });

    // 4. Procedural Textures, PBR Materials, Sandworm Model, Kinematics & Desert World
    this.textures = createProceduralTextures(this.renderer);
    this.materials = createSandwormMaterials(this.textures, this.isSoftwareGl);
    this.wormModel = new SandwormModel(this.materials, this.isSoftwareGl);
    this.scene.add(this.wormModel.root);

    this.kinematics = new SandwormKinematics();
    this.environment = new DesertEnvironment(this.scene, this.textures, this.isSoftwareGl);
    this.scene.add(this.environment.root);

    // 5. Post-Processing Bloom Pipeline (GPU only; bypassed on software WebGL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(width * 0.5), Math.floor(height * 0.5)),
        0.42, // subtle cinematic amber plasma bloom
        0.55,
        0.92,
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    // Raycast strictly against invisible Layer 1 collision capsules for zero frame drops
    this.raycaster.layers.set(1);

    // Seed initial pose immediately before first frame so frame 0 is heroic
    const initKin = this.kinematics.update(
      0.016,
      initialConfig.animationState,
      initialConfig.speed,
      initialConfig.isPaused,
      initialConfig.jawOverride,
    );
    this.wormModel.updateFromPoses(
      initKin.poses,
      0,
      initKin.jawAperture,
      initKin.turbineAngle,
      initialConfig.inspection.explodedAmount,
      initialConfig.inspection.selectedSegmentIndex,
      initialConfig.environment.heatDistortion,
    );
    this.callbacks.onTelemetry(initKin.telemetry);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind DOM & WebGL lifecycle events
    this.handleResizeBound = this.handleResize.bind(this);
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handleContextLostBound = this.handleContextLost.bind(this);
    this.handleContextRestoredBound = this.handleContextRestored.bind(this);

    window.addEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUpBound);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMoveBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLostBound);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestoredBound);

    this.lastCameraNonce = initialConfig.cameraNonce;
    this.lastJawSurgeNonce = initialConfig.jawSurgeNonce;
    this.lastZoomNonce = initialConfig.zoomStepNonce;
    this.lastTimeMs = performance.now();
    this.tick();
  }

  public updateConfig(next: SimulationConfig): void {
    this.config = next;

    if (next.jawSurgeNonce !== this.lastJawSurgeNonce) {
      this.lastJawSurgeNonce = next.jawSurgeNonce;
      this.kinematics.triggerJawSurge();
    }

    if (next.cameraNonce !== this.lastCameraNonce) {
      this.lastCameraNonce = next.cameraNonce;
      this.activeCameraTransition = next.cameraPreset;
    }

    if (next.zoomStepNonce !== this.lastZoomNonce) {
      this.lastZoomNonce = next.zoomStepNonce;
      this.applyZoomStep(next.zoomDelta);
    }

    this.materials.setInternalXRay(next.inspection.internalMachineryVisible);
    this.materials.setWireframe(next.inspection.wireframeChassis);
    this.controls.autoRotate = !this.isSoftwareGl && next.autoOrbit;
    this.controls.autoRotateSpeed = 0.85;
  }

  private applyZoomStep(deltaFactor: number): void {
    this.activeCameraTransition = null;
    const offset = _camDesiredPos.subVectors(this.camera.position, this.controls.target);
    const currentDist = offset.length();
    const nextDist = THREE.MathUtils.clamp(
      currentDist * deltaFactor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    offset.setLength(nextDist);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  private computeCameraGoal(preset: CameraPreset): void {
    const head = this.kinematics.poses[0];
    const mid = this.kinematics.poses[24];
    const tail = this.kinematics.poses[TOTAL_SEGMENTS - 1];

    _headForward.set(0, 0, 1).applyQuaternion(head.quaternion).normalize();
    _headRight.set(1, 0, 0).applyQuaternion(head.quaternion).normalize();

    if (preset === 'cinematic') {
      _camDesiredTarget.set(head.position.x * 0.45, Math.max(8, head.position.y * 0.55), head.position.z * 0.3);
      _camDesiredPos.set(48, 22, 64);
    } else if (preset === 'maw') {
      _camDesiredTarget.copy(head.position).addScaledVector(_headForward, 3.0);
      _camOffset.set(0, 4.5, 0);
      _camDesiredPos
        .copy(head.position)
        .addScaledVector(_headForward, 22.0)
        .addScaledVector(_headRight, 9.5)
        .add(_camOffset);
    } else if (preset === 'aerial') {
      _camDesiredTarget.set(mid.position.x * 0.4, 4, mid.position.z * 0.4);
      _camDesiredPos.set(14, 96, 78);
    } else if (preset === 'engineering') {
      _camDesiredTarget.set(mid.position.x, Math.max(10, mid.position.y + 4), mid.position.z);
      _camDesiredPos.set(mid.position.x + 56, Math.max(18, mid.position.y + 12), mid.position.z + 18);
    } else if (preset === 'tail') {
      _camDesiredTarget.copy(tail.position);
      _camOffset.set(24, 14, -22);
      _camDesiredPos.copy(tail.position).add(_camOffset);
    } else if (preset === 'segment') {
      const idx = this.config.inspection.selectedSegmentIndex ?? 0;
      const clamped = Math.max(0, Math.min(TOTAL_SEGMENTS - 1, idx));
      const sp = this.kinematics.poses[clamped];
      const dist = Math.max(16, sp.radius * 4.4);
      _camDesiredTarget.copy(sp.position);
      _camDesiredPos.set(sp.position.x + dist * 0.85, Math.max(6, sp.position.y + dist * 0.35), sp.position.z + dist * 0.72);
    }
  }

  private raycastSegment(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _rayMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _rayMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_rayMouse, this.camera);
    const hits = this.raycaster.intersectObject(this.wormModel.raycastProxyMesh, false);
    if (hits.length > 0 && typeof hits[0].instanceId === 'number') {
      return hits[0].instanceId;
    }
    return null;
  }

  private handlePointerDown(e: PointerEvent): void {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private handlePointerUp(e: PointerEvent): void {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    // Distinguish click from camera orbit drag
    if (Math.hypot(dx, dy) > 6) return;

    const hitIdx = this.raycastSegment(e.clientX, e.clientY);
    if (hitIdx !== null) {
      this.callbacks.onSegmentSelect(hitIdx);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const now = performance.now();
    if (now - this.lastHoverRaycast < 65) return; // throttled ~15Hz hover raycast
    this.lastHoverRaycast = now;

    const hitIdx = this.raycastSegment(e.clientX, e.clientY);
    this.renderer.domElement.style.cursor = hitIdx !== null ? 'pointer' : 'grab';
    this.callbacks.onSegmentHover(hitIdx);
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(Math.floor(width * 0.5), Math.floor(height * 0.5));
    }
  }

  private handleContextLost(e: Event): void {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  }

  private handleContextRestored(): void {
    this.callbacks.onContextLost(false);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 85);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const delta = Math.min((nowMs - this.lastTimeMs) / 1000, 0.1);
    this.lastTimeMs = nowMs;

    if (!this.config.isPaused) {
      this.elapsed += delta * this.config.speed;
    }

    // 1. Advance Sandworm spine kinematics & mechanical articulation
    const kin = this.kinematics.update(
      delta,
      this.config.animationState,
      this.config.speed,
      this.config.isPaused,
      this.config.jawOverride,
    );

    // 2. Smooth exponential damping for Exploded-View armor separation
    this.currentExploded = THREE.MathUtils.damp(
      this.currentExploded,
      this.config.inspection.explodedAmount,
      5.5,
      delta,
    );

    // 3. Update 180-segment instanced meshes, head jaw, hydraulics, gears & shaders
    this.materials.updateUniforms(
      this.elapsed,
      kin.energyIntensity,
      this.config.environment.heatDistortion,
    );
    this.wormModel.updateFromPoses(
      kin.poses,
      this.elapsed,
      kin.jawAperture,
      kin.turbineAngle,
      this.currentExploded,
      this.config.inspection.selectedSegmentIndex,
      this.config.environment.heatDistortion,
    );

    // 4. Update desert environment, dynamic time of day, sandstorms, and sand displacement
    const activityFactor = THREE.MathUtils.clamp(
      kin.telemetry.movementSpeedMs / 35 + kin.jawAperture * 0.45,
      0.15,
      1.35,
    );
    this.environment.update(
      delta,
      this.elapsed,
      this.config.environment,
      this.config.inspection.showEngineeringGrid || this.config.viewMode === 'engineering',
      kin.breachPoints,
      activityFactor,
      this.renderer,
    );

    // 5. Update optional procedural Web Audio soundscape
    this.sound.update(
      this.config.animationState,
      kin.jawAperture,
      this.config.environment.sandstormEnabled ? this.config.environment.sandstormIntensity : 0.1,
      kin.telemetry.movementSpeedMs / 45,
    );

    // 6. Smooth damped camera preset transitions (clear on arrival or user drag)
    if (this.activeCameraTransition) {
      this.computeCameraGoal(this.activeCameraTransition);
      const camLambda = 4.2;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesiredPos.x, camLambda, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesiredPos.y, camLambda, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesiredPos.z, camLambda, delta);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, _camDesiredTarget.x, camLambda, delta);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, _camDesiredTarget.y, camLambda, delta);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, _camDesiredTarget.z, camLambda, delta);

      if (
        this.camera.position.distanceTo(_camDesiredPos) < 0.45 &&
        this.controls.target.distanceTo(_camDesiredTarget) < 0.35
      ) {
        this.activeCameraTransition = null;
      }
    }

    this.controls.update();

    // 7. Render frame (Composer + Bloom on GPU; direct render + fence-sync pacing on software WebGL)
    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    // 8. Emit throttled telemetry (~8 Hz) to React HUD without triggering unnecessary churn
    if (nowMs - this.lastTelemetryEmit > 125) {
      this.lastTelemetryEmit = nowMs;
      this.callbacks.onTelemetry(kin.telemetry);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUpBound);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMoveBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLostBound);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestoredBound);

    this.controls.dispose();
    this.wormModel.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.envRT.dispose();
    this.sound.dispose();
    this.composer?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
