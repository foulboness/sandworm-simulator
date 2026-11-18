import * as THREE from 'three';

/**
 * Deterministic multi-octave Erg desert dune topography.
 * Shared across terrain geometry, industrial outpost placement,
 * rock clusters, particle collision, and worm breach math.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Primary sweeping barchan dune ridges (oriented obliquely to the sun)
  const ridge1 = Math.sin(x * 0.022 + z * 0.015) * 4.4;
  const ridge2 = Math.cos(x * 0.014 - z * 0.026 + 1.2) * 3.6;

  // Sharp wind-sculpted dune crests (abs-sine profile gives realistic slip-faces)
  const sharpCrest = (1.0 - Math.abs(Math.sin(x * 0.031 + z * 0.019 + Math.sin(z * 0.011) * 1.4))) * 4.2 - 2.1;

  // Medium secondary undulations
  const medium =
    Math.sin(x * 0.068 - z * 0.044) * 1.15 +
    Math.cos(x * 0.052 + z * 0.079) * 0.85;

  // Subtle fine wind-blown swells
  const fine = Math.sin(x * 0.16 + z * 0.12) * 0.22;

  // Gentle bowl depression in the immediate showcase arena (r < 42m)
  // rising into towering outer horizon dunes for natural outdoor framing
  const arenaFlatten = THREE.MathUtils.smoothstep(distFromCenter, 12, 65);
  const outerRise = THREE.MathUtils.smoothstep(distFromCenter, 75, 220) * 14.0;

  const rawHeight = (ridge1 + ridge2 + sharpCrest) * (0.38 + 0.62 * arenaFlatten) + medium * 0.75 + fine;
  return rawHeight + outerRise - 1.5;
}

export function getTerrainNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.6;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  return out.set(hL - hR, 2 * eps, hD - hU).normalize();
}
