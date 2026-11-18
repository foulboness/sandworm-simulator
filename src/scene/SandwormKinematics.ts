import * as THREE from 'three';
import {
  getSegmentRadius,
  TOTAL_SEGMENTS,
  type AnimationState,
  type TelemetryData,
} from '../types/sandwraith';
import type { SegmentPose } from './SandwormModel';
import { getTerrainHeight } from './terrainMath';

const SEGMENT_SPACING = 1.34; // 180 * 1.34 = ~241.2m total body length

// Reusable math temporaries
const _tangent = new THREE.Vector3();
const _prevTangent = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fallbackUp = new THREE.Vector3(0, 0, 1);
const _rotMat = new THREE.Matrix4();
const _deltaQuat = new THREE.Quaternion();
const _targetPos = new THREE.Vector3();

export interface KinematicsOutput {
  poses: SegmentPose[];
  jawAperture: number;
  turbineAngle: number;
  energyIntensity: number;
  breachPoints: THREE.Vector3[]; // World positions near sand surface for terrain wake & sand eruption
  telemetry: TelemetryData;
}

export class SandwormKinematics {
  public readonly poses: SegmentPose[] = [];
  public readonly breachPoints: THREE.Vector3[] = [];

  private simTime = 0;
  private stateTime = 0;
  private lastState: AnimationState = 'emergence';

  private currentJaw = 0.28;
  private jawSurgeTimer = 0;
  private turbineAngle = 0;
  private currentEnergy = 0.65;
  private smoothedSpeed = 14.2;

  private readonly rawPoints: THREE.Vector3[] = [];
  private readonly smoothedPoints: THREE.Vector3[] = [];
  private initialized = false;

  constructor() {
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      this.poses.push({
        position: new THREE.Vector3(0, 0, -i * SEGMENT_SPACING),
        quaternion: new THREE.Quaternion(),
        radius: getSegmentRadius(i),
        curvature: 0,
      });
      this.rawPoints.push(new THREE.Vector3());
      this.smoothedPoints.push(new THREE.Vector3());
    }
    for (let i = 0; i < 12; i++) {
      this.breachPoints.push(new THREE.Vector3(0, -100, 0));
    }
  }

  public triggerJawSurge(): void {
    this.jawSurgeTimer = 2.6;
  }

  /**
   * Computes a target world-space spine point at normalized distance `u` (0 = head, 1 = tail)
   * for each of the 7 heavy cinematic animation states.
   */
  private evaluateTargetSpine(
    state: AnimationState,
    t: number,
    sTime: number,
    outPoints: THREE.Vector3[],
  ): {
    targetJaw: number;
    targetEnergy: number;
    targetSpeedMs: number;
    turbineRpm: number;
  } {
    let targetJaw = 0.2;
    let targetEnergy = 0.55;
    let targetSpeedMs = 12;
    let turbineRpm = 42;

    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const dist = i * SEGMENT_SPACING;
      const u = i / (TOTAL_SEGMENTS - 1);
      let x = 0;
      let y = 0;
      let z = 0;

      if (state === 'emergence') {
        // Iconic Dune breach: towering S-curved anterior neck soaring ~30m over the desert,
        // plunging into a crater around segment 42, arching dramatically over a second dune crest
        // around segments 72..120, then diving deep into the desert sands!
        const riseCycle = 0.72 + Math.sin(t * 0.42 + 0.55) * 0.28; // starts majestic on frame 0
        const sway = Math.sin(t * 0.65 - dist * 0.032);

        const arch1 = Math.exp(-Math.pow((dist - 10) / 34, 2)) * 31.5 * riseCycle;
        const arch2 = Math.exp(-Math.pow((dist - 118) / 36, 2)) * 18.5;
        const tailDive = -THREE.MathUtils.smoothstep(dist, 145, 225) * 14.0;
        const midDip = -Math.exp(-Math.pow((dist - 66) / 20, 2)) * 8.5;

        // Forward sweep from rear-left toward front-right with majestic head curve
        z = 26 - dist * 0.74 + Math.sin(dist * 0.042 - t * 0.55) * 6.5;
        x = Math.sin(dist * 0.036 - t * 0.48) * 16.5 + sway * (1 - u * 0.4) * 3.8;
        const ground = getTerrainHeight(x, z);
        y = ground - 4.8 + arch1 + arch2 + midDip + tailDive;

        // Slight proud forward lift at the head collar
        if (i < 16) {
          const headBoost = (1 - i / 16) * 4.5 * riseCycle;
          y += headBoost;
          z += (1 - i / 16) * 4.2;
        }

        targetJaw = 0.34 + Math.sin(t * 0.9) * 0.14;
        targetEnergy = 0.74 + Math.sin(t * 1.4) * 0.1;
        targetSpeedMs = 18.4;
        turbineRpm = 68;
      } else if (state === 'idle') {
        // Alert mechanical breathing poise — tall anterior sentry arch + grounded dorsal coil
        const breathe = Math.sin(t * 1.1) * 1.4;
        const headScanX = Math.sin(t * 0.52) * 5.8;

        const neckHeight = Math.exp(-Math.pow((dist - 14) / 34, 2)) * (26.5 + breathe);
        const coilArch = Math.exp(-Math.pow((dist - 112) / 34, 2)) * 13.5;
        const dip = -Math.exp(-Math.pow((dist - 64) / 20, 2)) * 7.2;

        z = 22 - dist * 0.75 + Math.cos(dist * 0.03) * 4.5;
        x =
          Math.sin(dist * 0.034) * 15.0 +
          headScanX * Math.exp(-dist * 0.035) +
          Math.sin(t * 0.7 - dist * 0.04) * 1.3;
        const ground = getTerrainHeight(x, z);
        y = ground - 4.2 + neckHeight + coilArch + dip - THREE.MathUtils.smoothstep(dist, 148, 225) * 12;

        targetJaw = 0.14 + Math.sin(t * 1.3) * 0.06;
        targetEnergy = 0.46;
        targetSpeedMs = 2.4;
        turbineRpm = 28;
      } else if (state === 'movement') {
        // Colossal sinusoidal desert slithering — continuous porpoising locomotion wave
        const phase = t * 1.55;
        const loopRadiusX = 34;
        const loopRadiusZ = 38;
        const pathAngle = phase * 0.24 - dist * 0.0155;

        const baseX = Math.sin(pathAngle) * loopRadiusX;
        const baseZ = Math.cos(pathAngle) * loopRadiusZ;

        // Lateral serpentine undulation perpendicular to trajectory
        const lateralWave = Math.sin(dist * 0.075 - phase * 2.2) * 7.5;
        const tangentX = Math.cos(pathAngle);
        const tangentZ = -Math.sin(pathAngle);
        x = baseX - tangentZ * lateralWave;
        z = baseZ + tangentX * lateralWave;

        // Heavy rhythmic dune-breaching waves travelling head -> tail
        const verticalWave = Math.sin(dist * 0.068 - phase * 1.95);
        const ground = getTerrainHeight(x, z);
        // Crest ~14m above dunes, trough ~8m beneath dunes
        y = ground + 1.8 + verticalWave * 11.8 + Math.exp(-dist * 0.04) * 4.5;

        targetJaw = 0.36 + Math.max(0, Math.sin(phase * 1.95)) * 0.22;
        targetEnergy = 0.86;
        targetSpeedMs = 36.8;
        turbineRpm = 104;
      } else if (state === 'roaring') {
        // Towering intimidated cobra-like roar: front 55 segments rear 38m high,
        // seismic micro-vibration, jaw wide open aiming skyward/forward
        const tremorX = Math.sin(t * 24.0 + dist * 0.4) * 0.28 * Math.exp(-dist * 0.018);
        const tremorY = Math.cos(t * 21.0 + dist * 0.3) * 0.22 * Math.exp(-dist * 0.018);
        const roarSway = Math.sin(t * 1.15) * 4.2;

        const rearTower = Math.exp(-Math.pow((dist - 4) / 36, 2)) * 39.0;
        const backCoil = Math.exp(-Math.pow((dist - 108) / 32, 2)) * 16.0;
        const craterDip = -Math.exp(-Math.pow((dist - 58) / 18, 2)) * 9.5;

        // Head curves slightly backward then proudly forward
        z = 16 - dist * 0.68 + Math.exp(-Math.pow((dist - 18) / 16, 2)) * 8.5 + (dist < 14 ? (14 - dist) * 0.55 : 0);
        x = Math.sin(dist * 0.042 + 0.4) * 14.5 + roarSway * Math.exp(-dist * 0.028) + tremorX;
        const ground = getTerrainHeight(x, z);
        y = ground - 4.4 + rearTower + backCoil + craterDip + tremorY - THREE.MathUtils.smoothstep(dist, 145, 220) * 12;

        targetJaw = 0.96 + Math.sin(t * 6.5) * 0.04;
        targetEnergy = 1.25;
        targetSpeedMs = 8.6;
        turbineRpm = 148;
      } else if (state === 'attack') {
        // Predatory coiled strike lunge! Cyclic recoil -> explosive forward lunging arc
        const cycle = (sTime * 0.55) % (Math.PI * 2);
        // Smooth asymmetric strike curve: wind-up coil -> rapid forward lunge -> follow-through
        const lunge = Math.pow(Math.max(0, Math.sin(cycle)), 0.75);
        const coilBack = Math.max(0, -Math.sin(cycle));

        const headForwardZ = 12 + lunge * 32 - coilBack * 12;
        const headLiftY = 18 + Math.sin(lunge * Math.PI) * 14 + coilBack * 15;

        const headWeight = Math.exp(-dist * 0.026);
        z = headForwardZ - dist * 0.72 + Math.sin(dist * 0.055 - t * 3.4) * 4.8 * (1 - headWeight * 0.5);
        x = Math.sin(dist * 0.048 - t * 2.8) * (12.5 + coilBack * 7.0) + Math.sin(t * 3.2) * 3.2 * headWeight;

        const ground = getTerrainHeight(x, z);
        const bodyArch = Math.exp(-Math.pow((dist - 92) / 34, 2)) * 16.5;
        const dip = -Math.exp(-Math.pow((dist - 50) / 17, 2)) * 8.0;
        y = ground - 4.2 + headLiftY * headWeight + bodyArch + dip - THREE.MathUtils.smoothstep(dist, 140, 220) * 11;

        targetJaw = 0.45 + lunge * 0.55;
        targetEnergy = 1.15 + lunge * 0.25;
        targetSpeedMs = 24.0 + lunge * 24.5;
        turbineRpm = 112 + lunge * 46;
      } else if (state === 'underground') {
        // Subterranean transit: cruises right beneath the sand surface leaving colossal moving dunes & ridges!
        const phase = t * 1.25;
        const angle = phase * 0.28 - dist * 0.016;
        const radX = 36;
        const radZ = 34;

        const bx = Math.sin(angle) * radX;
        const bz = Math.cos(angle) * radZ;
        const wiggle = Math.sin(dist * 0.08 - phase * 2.4) * 6.5;
        x = bx + Math.sin(angle + 1.57) * wiggle;
        z = bz + Math.cos(angle + 1.57) * wiggle;

        const ground = getTerrainHeight(x, z);
        // Hover just below the dune skin so dorsal crests occasionally scrape the surface
        const shallowSurf = Math.sin(dist * 0.05 - phase * 1.4) * 2.8;
        y = ground - 4.3 + shallowSurf;

        targetJaw = 0.55; // grinding actively through subterranean quartz
        targetEnergy = 0.92;
        targetSpeedMs = 31.4;
        turbineRpm = 128;
      } else {
        // 'retreat': Heavy controlled plunge downward back into the desert floor
        const diveProgress = 0.5 - 0.5 * Math.cos(Math.min(Math.PI, sTime * 0.48));
        // Loops smoothly after lingering underground
        const loopT = sTime % 11.5;
        const smoothDive =
          loopT < 6.0
            ? THREE.MathUtils.smoothstep(loopT, 0.0, 5.2)
            : loopT < 8.5
              ? 1.0
              : 1.0 - THREE.MathUtils.smoothstep(loopT, 8.5, 11.5);
        const depthFactor = Math.max(diveProgress * 0.2, smoothDive);

        const arch1 = Math.exp(-Math.pow((dist - 12) / 32, 2)) * 28.0 * (1 - depthFactor * 0.95);
        const arch2 = Math.exp(-Math.pow((dist - 108) / 34, 2)) * 16.0 * (1 - depthFactor * 0.82);

        z = 22 - dist * 0.74 - depthFactor * 18.0;
        x = Math.sin(dist * 0.036 - t * 0.35) * 14.0;
        const ground = getTerrainHeight(x, z);
        y = ground - 4.6 - depthFactor * 9.5 + arch1 + arch2 - THREE.MathUtils.smoothstep(dist, 140, 220) * 10;

        targetJaw = (1 - depthFactor) * 0.25;
        targetEnergy = 0.6 - depthFactor * 0.3;
        targetSpeedMs = 14.0 * (1 - depthFactor * 0.5);
        turbineRpm = Math.round(54 * (1 - depthFactor * 0.6));
      }

      outPoints[i].set(x, y, z);
    }

    // Enforce exact inextensible arc-length spacing along the spine from head -> tail
    // so mechanical segments never stretch apart or crush into each other!
    for (let i = 1; i < TOTAL_SEGMENTS; i++) {
      const prev = outPoints[i - 1];
      const curr = outPoints[i];
      _tangent.subVectors(curr, prev);
      const len = _tangent.length();
      if (len > 0.0001) {
        _tangent.multiplyScalar(SEGMENT_SPACING / len);
        curr.copy(prev).add(_tangent);
      } else {
        curr.copy(prev).addScaledVector(_fallbackUp, -SEGMENT_SPACING);
      }
    }

    return { targetJaw, targetEnergy, targetSpeedMs, turbineRpm };
  }

  public update(
    delta: number,
    state: AnimationState,
    speedMultiplier: number,
    isPaused: boolean,
    jawOverride: number | null,
  ): KinematicsOutput {
    const dt = Math.min(delta, 0.08);

    if (state !== this.lastState) {
      this.lastState = state;
      this.stateTime = 0;
    }

    if (!isPaused) {
      this.simTime += dt * speedMultiplier;
      this.stateTime += dt * speedMultiplier;
    }

    if (this.jawSurgeTimer > 0) {
      this.jawSurgeTimer = Math.max(0, this.jawSurgeTimer - dt);
    }

    const meta = this.evaluateTargetSpine(state, this.simTime, this.stateTime, this.rawPoints);

    // Smooth heavy exponential damping between animation states (snap only on frame 0)
    const posLambda = this.initialized ? 3.8 : 1000;
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const sp = this.smoothedPoints[i];
      const rp = this.rawPoints[i];
      if (!this.initialized) {
        sp.copy(rp);
      } else {
        sp.x = THREE.MathUtils.damp(sp.x, rp.x, posLambda, dt);
        sp.y = THREE.MathUtils.damp(sp.y, rp.y, posLambda, dt);
        sp.z = THREE.MathUtils.damp(sp.z, rp.z, posLambda, dt);
      }
    }
    this.initialized = true;

    // Re-enforce exact inextensible arc-length after cross-fade damping
    for (let i = 1; i < TOTAL_SEGMENTS; i++) {
      const prev = this.smoothedPoints[i - 1];
      const curr = this.smoothedPoints[i];
      _tangent.subVectors(curr, prev);
      const len = _tangent.length();
      if (len > 0.0001) {
        _tangent.multiplyScalar(SEGMENT_SPACING / len);
        curr.copy(prev).add(_tangent);
      }
    }

    // Build stable twist-free Parallel Transport Frames (local +Z points forward toward head!)
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const pose = this.poses[i];
      pose.position.copy(this.smoothedPoints[i]);

      if (i === 0) {
        _tangent.subVectors(this.smoothedPoints[0], this.smoothedPoints[1]).normalize();
      } else if (i === TOTAL_SEGMENTS - 1) {
        _tangent.subVectors(this.smoothedPoints[i - 1], this.smoothedPoints[i]).normalize();
      } else {
        _tangent.subVectors(this.smoothedPoints[i - 1], this.smoothedPoints[i + 1]).normalize();
      }

      if (i === 0) {
        // Initialize reference up vector cleanly without gimbal singularity
        const refUp = Math.abs(_tangent.dot(_worldUp)) > 0.94 ? _fallbackUp : _worldUp;
        _right.crossVectors(refUp, _tangent).normalize();
        _up.crossVectors(_tangent, _right).normalize();
        pose.curvature = 0;
      } else {
        // Parallel transport previous up vector onto new tangent plane
        _deltaQuat.setFromUnitVectors(_prevTangent, _tangent);
        _up.applyQuaternion(_deltaQuat).normalize();
        // Gently bias dorsal ridge toward world sky so the spine stays heroically upright
        _targetPos.copy(_worldUp).addScaledVector(_tangent, -_worldUp.dot(_tangent));
        if (_targetPos.lengthSq() > 0.05) {
          _targetPos.normalize();
          _up.lerp(_targetPos, 0.14).normalize();
        }
        _right.crossVectors(_up, _tangent).normalize();
        _up.crossVectors(_tangent, _right).normalize();
        pose.curvature = 1 - THREE.MathUtils.clamp(_prevTangent.dot(_tangent), -1, 1);
      }

      _prevTangent.copy(_tangent);

      // Basis columns: X = _right, Y = _up, Z = _tangent (forward)
      _rotMat.makeBasis(_right, _up, _tangent);
      pose.quaternion.setFromRotationMatrix(_rotMat);
    }

    // Jaw aperture (manual override OR surge burst OR animation state)
    const surgeBoost = this.jawSurgeTimer > 0 ? Math.sin(Math.min(1, this.jawSurgeTimer / 2.6) * Math.PI) : 0;
    const desiredJaw =
      jawOverride !== null
        ? jawOverride
        : Math.min(1, Math.max(meta.targetJaw, surgeBoost));
    this.currentJaw = THREE.MathUtils.damp(this.currentJaw, desiredJaw, 5.2, dt);

    const desiredEnergy = meta.targetEnergy + surgeBoost * 0.45 + (jawOverride ?? 0) * 0.35;
    this.currentEnergy = THREE.MathUtils.damp(this.currentEnergy, desiredEnergy, 4.0, dt);

    const effectiveSpeed = isPaused ? 0 : meta.targetSpeedMs * speedMultiplier;
    this.smoothedSpeed = THREE.MathUtils.damp(this.smoothedSpeed, effectiveSpeed, 3.5, dt);

    const activeRpm = isPaused ? 0 : (meta.turbineRpm + surgeBoost * 85 + this.currentJaw * 40) * speedMultiplier;
    this.turbineAngle += (activeRpm / 60) * Math.PI * 2 * dt;

    // Collect 12 active surface/near-surface breach waypoints for real-time terrain displacement & eruption particles
    let bIdx = 0;
    for (let i = 0; i < TOTAL_SEGMENTS && bIdx < this.breachPoints.length; i += 10) {
      const p = this.poses[i].position;
      const gH = getTerrainHeight(p.x, p.z);
      const distToSurface = Math.abs(p.y - gH);
      if (distToSurface < 11.5) {
        this.breachPoints[bIdx].set(p.x, gH, p.z);
        bIdx++;
      }
    }
    // Always include head projection when subsurface or near dunes
    if (bIdx === 0) {
      const hp = this.poses[0].position;
      this.breachPoints[0].set(hp.x, getTerrainHeight(hp.x, hp.z), hp.z);
      bIdx = 1;
    }
    while (bIdx < this.breachPoints.length) {
      this.breachPoints[bIdx].set(9999, -999, 9999);
      bIdx++;
    }

    // Derive physically grounded engineering telemetry from live kinematics
    const headPos = this.poses[0].position;
    const headGround = getTerrainHeight(headPos.x, headPos.z);
    const subsurfaceDepthM = Math.max(0, Number((headGround - headPos.y).toFixed(1)));
    const hydraulicPressureBar = Math.round(
      310 + this.currentJaw * 165 + (this.smoothedSpeed / 45) * 95 + Math.sin(this.simTime * 2.1) * 6,
    );
    const coreEnergyOutputGW = Number(
      (1.32 + this.currentEnergy * 1.48 + (this.smoothedSpeed / 45) * 0.42).toFixed(2),
    );
    const operatingTempC = Math.round(
      610 + this.currentEnergy * 340 + this.currentJaw * 185,
    );
    const powerConsumptionMW = Math.round(coreEnergyOutputGW * 845);
    const structuralIntegrityPct = Number(
      (98.6 - (state === 'attack' ? 0.4 : 0) - (state === 'roaring' ? 0.2 : 0)).toFixed(1),
    );

    return {
      poses: this.poses,
      jawAperture: this.currentJaw,
      turbineAngle: this.turbineAngle,
      energyIntensity: this.currentEnergy,
      breachPoints: this.breachPoints,
      telemetry: {
        lengthM: 242.4,
        maxDiameterM: 11.8,
        estimatedMassTons: 48600,
        segmentCount: TOTAL_SEGMENTS,
        hydraulicPressureBar,
        coreEnergyOutputGW,
        structuralIntegrityPct,
        operatingTempC,
        movementSpeedMs: Number(this.smoothedSpeed.toFixed(1)),
        powerConsumptionMW,
        jawAperturePct: Math.round(this.currentJaw * 100),
        subsurfaceDepthM,
        turbineRpm: Math.round(activeRpm),
      },
    };
  }
}
