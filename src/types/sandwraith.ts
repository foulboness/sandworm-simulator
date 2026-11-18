export type AnimationState =
  | 'emergence'
  | 'idle'
  | 'movement'
  | 'roaring'
  | 'attack'
  | 'underground'
  | 'retreat';

export type CameraPreset =
  | 'cinematic'
  | 'maw'
  | 'aerial'
  | 'engineering'
  | 'tail'
  | 'segment';

export type TimeOfDay = 'dawn' | 'noon' | 'golden' | 'dusk' | 'night';

export type ViewMode = 'cinematic' | 'engineering';

export type DockTab =
  | 'animation'
  | 'engineering'
  | 'inspector'
  | 'environment'
  | 'camera'
  | 'overview';

export type ComponentCategory =
  | 'maw'
  | 'mandibles'
  | 'sensors'
  | 'armor'
  | 'energy-core'
  | 'hydraulics'
  | 'internal-drive'
  | 'tail-thruster';

export interface ComponentSpec {
  id: ComponentCategory;
  name: string;
  subsystem: string;
  segmentIndex: number;
  material: string;
  massTons: number;
  maxTempC: number;
  pressureBar: number;
  powerDrawMW: number;
  integrityPct: number;
  description: string;
  engineeringNotes: string;
}

export interface SelectedSegmentInfo {
  segmentIndex: number; // 0 = head/maw, 1..178 = body segments, 179 = tail thruster
  category: ComponentCategory;
  label: string;
  diameterM: number;
  localTempC: number;
  hydraulicBar: number;
  coreOutputMW: number;
  integrityPct: number;
  sectionRole: string;
  materialSpec: string;
  description: string;
}

export interface TelemetryData {
  lengthM: number;
  maxDiameterM: number;
  estimatedMassTons: number;
  segmentCount: number;
  hydraulicPressureBar: number;
  coreEnergyOutputGW: number;
  structuralIntegrityPct: number;
  operatingTempC: number;
  movementSpeedMs: number;
  powerConsumptionMW: number;
  jawAperturePct: number;
  subsurfaceDepthM: number;
  turbineRpm: number;
}

export interface EnvironmentSettings {
  timeOfDay: TimeOfDay;
  sandstormIntensity: number; // 0 to 1
  sandstormEnabled: boolean;
  volumetricLighting: boolean;
  atmosphericFog: boolean;
  heatDistortion: boolean;
  sandDisplacement: boolean;
  outpostStructures: boolean;
}

export interface InspectionSettings {
  explodedAmount: number; // 0 to 1
  internalMachineryVisible: boolean; // X-ray / armor cutaway transparency
  wireframeChassis: boolean;
  showEngineeringGrid: boolean;
  selectedSegmentIndex: number | null;
  selectedComponent: ComponentCategory;
}

export interface SimulationConfig {
  viewMode: ViewMode;
  animationState: AnimationState;
  isPaused: boolean;
  speed: number; // 0.2 to 2.5
  jawOverride: number | null; // null = animation controlled, 0..1 = manual
  jawSurgeNonce: number; // incremented on manual jaw activation burst
  cameraPreset: CameraPreset;
  cameraNonce: number;
  autoOrbit: boolean;
  zoomStepNonce: number;
  zoomDelta: number;
  environment: EnvironmentSettings;
  inspection: InspectionSettings;
}

export const TOTAL_SEGMENTS = 180;

export const ANIMATION_MODES: Array<{
  id: AnimationState;
  label: string;
  summary: string;
}> = [
  { id: 'emergence', label: 'Emergence', summary: 'Towering breach out of deep desert dunes' },
  { id: 'idle', label: 'Idle', summary: 'Low-power hydraulic sway and pulsing reactor cores' },
  { id: 'movement', label: 'Movement', summary: 'Sinusoidal travelling waves through shifting dunes' },
  { id: 'roaring', label: 'Roaring', summary: 'Full jaw flare, counter-rotating crusher activation' },
  { id: 'attack', label: 'Attack', summary: 'High-velocity lunge with mandibles extended' },
  { id: 'underground', label: 'Underground', summary: 'Subterranean transit beneath rolling sand crests' },
  { id: 'retreat', label: 'Retreat', summary: 'Controlled descent back beneath the desert crust' },
];

export const TIME_OF_DAY_PRESETS: Array<{
  id: TimeOfDay;
  label: string;
  clock: string;
}> = [
  { id: 'dawn', label: 'Dawn', clock: '06:15' },
  { id: 'noon', label: 'High Noon', clock: '12:40' },
  { id: 'golden', label: 'Golden Hour', clock: '17:20' },
  { id: 'dusk', label: 'Dusk', clock: '19:45' },
  { id: 'night', label: 'Night', clock: '23:10' },
];

export const CAMERA_PRESETS: Array<{
  id: CameraPreset;
  label: string;
}> = [
  { id: 'cinematic', label: 'Cinematic Wide' },
  { id: 'maw', label: 'Crusher Maw' },
  { id: 'aerial', label: 'Aerial Dune' },
  { id: 'engineering', label: 'Engineering Profile' },
  { id: 'tail', label: 'Tail Thruster' },
];

export const COMPONENT_CATALOG: Record<ComponentCategory, ComponentSpec> = {
  maw: {
    id: 'maw',
    name: 'Circular Crusher Maw',
    subsystem: 'Anterior Excavation Assembly',
    segmentIndex: 0,
    material: 'Tungsten-Carbide / Sintered Ti-6Al-4V',
    massTons: 1840,
    maxTempC: 1180,
    pressureBar: 540,
    powerDrawMW: 620,
    integrityPct: 99.1,
    description:
      'Three concentric counter-rotating tooth rings paired with six articulated armor cowl petals engineered to pulverize bedrock and vitrified silica.',
    engineeringNotes:
      'Outer ring deploys 18 cantilevered crusher fangs; middle grinder spins up to 140 RPM; inner intake feeds directly into the thermal liquefaction furnace.',
  },
  mandibles: {
    id: 'mandibles',
    name: 'Articulated Mandibles',
    subsystem: 'Bore Stabilization & Grapple Rig',
    segmentIndex: 1,
    material: 'Forged Maraging Steel / Ceramic Wear Edges',
    massTons: 610,
    maxTempC: 890,
    pressureBar: 580,
    powerDrawMW: 240,
    integrityPct: 98.4,
    description:
      'Four radially opposed hydraulic pincers that anchor the anterior hull during high-resistance tunneling and flare outward during aggressive breaches.',
    engineeringNotes:
      'Driven by dual-stage telescopic rams with integrated shock accumulators rated to 42 MN peak lateral load.',
  },
  sensors: {
    id: 'sensors',
    name: 'Optical & Seismic Array',
    subsystem: 'Navigation & Threat Telemetry',
    segmentIndex: 3,
    material: 'Sapphire Optical Lenses / Gold-Plated Beryllium Housing',
    massTons: 84,
    maxTempC: 410,
    pressureBar: 120,
    powerDrawMW: 68,
    integrityPct: 99.7,
    description:
      'Multi-spectral optical clusters and acoustic ground-penetrating lidar arrays embedded beneath reinforced brow cowlings.',
    engineeringNotes:
      'Detects surface vibrations up to 14 kilometers through loose desert quartz while maintaining dust-shedding ultrasonic lens coatings.',
  },
  armor: {
    id: 'armor',
    name: 'Layered Titanium Armor',
    subsystem: 'Abrasion-Resistant Exoskeleton',
    segmentIndex: 14,
    material: 'Anodized Titanium Alloy / Gunmetal Composite Backing',
    massTons: 21400,
    maxTempC: 760,
    pressureBar: 210,
    powerDrawMW: 45,
    integrityPct: 97.8,
    description:
      'Interlocking quad-plate exterior scales per segment that overlap like scales during tight turns while shedding high-pressure desert sand.',
    engineeringNotes:
      'Each dorsal crest houses passive thermal louver vents; plates detach radially along hydraulic guide rails for depot maintenance.',
  },
  'energy-core': {
    id: 'energy-core',
    name: 'Inter-Segment Plasma Cores',
    subsystem: 'Distributed Thermal-Fusion Bus',
    segmentIndex: 28,
    material: 'Silicon-Carbide Containment / Amber Plasma Coils',
    massTons: 6200,
    maxTempC: 1240,
    pressureBar: 460,
    powerDrawMW: 1480,
    integrityPct: 99.3,
    description:
      'Glowing toroidal energy junctions positioned between articulated bulkheads, supplying continuous gigawatt power down the entire 242-meter frame.',
    engineeringNotes:
      'Radiates waste heat through slotted amber vents, creating visible atmospheric heat shimmer around active high-output junctions.',
  },
  hydraulics: {
    id: 'hydraulics',
    name: 'Hydraulic Articulation Pistons',
    subsystem: 'Tri-Axis Locomotion Actuators',
    segmentIndex: 42,
    material: 'Hard-Chromed Tool Steel / High-Temp Synthetic Fluid',
    massTons: 7450,
    maxTempC: 620,
    pressureBar: 520,
    powerDrawMW: 410,
    integrityPct: 98.2,
    description:
      'Twin lateral and dorsal heavy-duty hydraulic cylinders linking every segment bulkhead to generate travelling sinusoidal propulsion waves.',
    engineeringNotes:
      '720 primary pistons operate in closed-loop phase coordination, dynamically shifting load during breach arcs and subterranean turns.',
  },
  'internal-drive': {
    id: 'internal-drive',
    name: 'Internal Helical Drive & Gears',
    subsystem: 'Central Torque & Intake Conduit',
    segmentIndex: 64,
    material: 'Case-Hardened Nickel-Chromium Alloy / Copper Busbars',
    massTons: 8920,
    maxTempC: 940,
    pressureBar: 380,
    powerDrawMW: 530,
    integrityPct: 98.9,
    description:
      'Counter-rotating involute spur gears, braided high-voltage power conduits, and a continuous helical sand-transfer core concealed beneath the armor.',
    engineeringNotes:
      'Toggle Exploded View or Internal Machinery Visibility to inspect live counter-rotating torque rings and structural bulkhead ribs.',
  },
  'tail-thruster': {
    id: 'tail-thruster',
    name: 'Tail Exhaust & Ballast Assembly',
    subsystem: 'Aft Sand Ejection & Stabilization',
    segmentIndex: TOTAL_SEGMENTS - 1,
    material: 'Inconel-718 Exhaust Shroud / Tungsten Vanes',
    massTons: 2096,
    maxTempC: 1080,
    pressureBar: 490,
    powerDrawMW: 310,
    integrityPct: 97.5,
    description:
      'Tapered rear expulsion cone that vents pulverized sand slurry and excess reactor heat to provide forward subterranean thrust.',
    engineeringNotes:
      'Vectored exhaust baffles modulate rear drag and stabilize pitch when breaching vertically through deep dune crests.',
  },
};

export function getSegmentRadius(index: number): number {
  const t = index / (TOTAL_SEGMENTS - 1);
  // Head collar starts massive (~5.4m radius -> 10.8m diameter), swells slightly at neck (~5.9m), tapers cleanly to tail (~1.6m)
  if (t < 0.06) {
    return 5.2 + Math.sin((t / 0.06) * Math.PI * 0.5) * 0.7;
  }
  const taper = Math.pow(1 - (t - 0.06) / 0.94, 0.72);
  return 1.55 + taper * 4.35;
}

export function buildSegmentInfo(
  segmentIndex: number,
  telemetry: TelemetryData,
): SelectedSegmentInfo {
  const clamped = Math.max(0, Math.min(TOTAL_SEGMENTS - 1, Math.round(segmentIndex)));
  const radius = getSegmentRadius(clamped);
  const t = clamped / (TOTAL_SEGMENTS - 1);

  let category: ComponentCategory = 'armor';
  let sectionRole = 'Mid-Body Articulated Armor Ring';
  let materialSpec = 'Sandblasted Ti-6Al-4V / Forged Gunmetal Bulkhead';
  let description =
    'Standard articulated hull section pairing four overlapping titanium armor shells with twin hydraulic wave actuators and an amber plasma bus junction.';

  if (clamped === 0) {
    category = 'maw';
    sectionRole = COMPONENT_CATALOG.maw.subsystem;
    materialSpec = COMPONENT_CATALOG.maw.material;
    description = COMPONENT_CATALOG.maw.description;
  } else if (clamped <= 2) {
    category = 'mandibles';
    sectionRole = COMPONENT_CATALOG.mandibles.subsystem;
    materialSpec = COMPONENT_CATALOG.mandibles.material;
    description = COMPONENT_CATALOG.mandibles.description;
  } else if (clamped <= 5) {
    category = 'sensors';
    sectionRole = COMPONENT_CATALOG.sensors.subsystem;
    materialSpec = COMPONENT_CATALOG.sensors.material;
    description = COMPONENT_CATALOG.sensors.description;
  } else if (clamped >= TOTAL_SEGMENTS - 4) {
    category = 'tail-thruster';
    sectionRole = COMPONENT_CATALOG['tail-thruster'].subsystem;
    materialSpec = COMPONENT_CATALOG['tail-thruster'].material;
    description = COMPONENT_CATALOG['tail-thruster'].description;
  } else if (clamped % 6 === 0) {
    category = 'energy-core';
    sectionRole = 'Primary Plasma Booster Node';
    materialSpec = COMPONENT_CATALOG['energy-core'].material;
    description = COMPONENT_CATALOG['energy-core'].description;
  } else if (clamped % 4 === 0) {
    category = 'hydraulics';
    sectionRole = 'Heavy Torque Articulation Joint';
    materialSpec = COMPONENT_CATALOG.hydraulics.material;
    description = COMPONENT_CATALOG.hydraulics.description;
  } else if (clamped % 5 === 0) {
    category = 'internal-drive';
    sectionRole = 'Internal Helical Gear Transfer Bay';
    materialSpec = COMPONENT_CATALOG['internal-drive'].material;
    description = COMPONENT_CATALOG['internal-drive'].description;
  }

  const heatProfile = 1 - t * 0.28 + (clamped % 6 === 0 ? 0.14 : 0);
  const localTempC = Math.round(telemetry.operatingTempC * heatProfile);
  const hydraulicBar = Math.round(
    telemetry.hydraulicPressureBar * (0.85 + Math.sin(t * Math.PI) * 0.25),
  );
  const coreOutputMW = Number(
    ((telemetry.coreEnergyOutputGW * 1000) / TOTAL_SEGMENTS * (clamped % 6 === 0 ? 1.8 : 0.95)).toFixed(1),
  );
  const integrityPct = Number((97.2 + ((clamped * 17) % 26) * 0.1).toFixed(1));

  return {
    segmentIndex: clamped,
    category,
    label:
      clamped === 0
        ? 'SEG-001 · Anterior Crusher Maw'
        : clamped === TOTAL_SEGMENTS - 1
          ? `SEG-${String(TOTAL_SEGMENTS).padStart(3, '0')} · Tail Exhaust Assembly`
          : `SEG-${String(clamped + 1).padStart(3, '0')} · ${sectionRole}`,
    diameterM: Number((radius * 2).toFixed(2)),
    localTempC,
    hydraulicBar,
    coreOutputMW,
    integrityPct,
    sectionRole,
    materialSpec,
    description,
  };
}
