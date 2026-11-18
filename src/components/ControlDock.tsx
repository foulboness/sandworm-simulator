import {
  Camera,
  ChevronDown,
  ChevronUp,
  Cpu,
  Crosshair,
  Flame,
  Info,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ANIMATION_MODES,
  buildSegmentInfo,
  CAMERA_PRESETS,
  COMPONENT_CATALOG,
  TIME_OF_DAY_PRESETS,
  TOTAL_SEGMENTS,
  type AnimationState,
  type CameraPreset,
  type ComponentCategory,
  type DockTab,
  type EnvironmentSettings,
  type SimulationConfig,
  type TelemetryData,
  type TimeOfDay,
} from '../types/sandwraith';

interface ControlDockProps {
  config: SimulationConfig;
  telemetry: TelemetryData;
  activeTab: DockTab;
  onTabChange: (tab: DockTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAnimationChange: (state: AnimationState) => void;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onJawOverrideChange: (val: number | null) => void;
  onTriggerJawSurge: () => void;
  onExplodedChange: (val: number) => void;
  onToggleInternalMachinery: () => void;
  onToggleWireframe: () => void;
  onToggleEngineeringGrid: () => void;
  onSelectComponent: (cat: ComponentCategory) => void;
  onSelectSegment: (index: number, focusCamera?: boolean) => void;
  onEnvironmentChange: (patch: Partial<EnvironmentSettings>) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onToggleAutoOrbit: () => void;
  onZoomStep: (factor: number) => void;
}

const TABS: Array<{ id: DockTab; label: string; icon: typeof Flame }> = [
  { id: 'animation', label: 'Animation', icon: Flame },
  { id: 'engineering', label: 'Engineering', icon: Cpu },
  { id: 'inspector', label: 'Inspector', icon: Crosshair },
  { id: 'environment', label: 'Environment', icon: Sun },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'overview', label: 'Overview', icon: Info },
];

const COMPONENT_LIST: ComponentCategory[] = [
  'maw',
  'mandibles',
  'sensors',
  'armor',
  'energy-core',
  'hydraulics',
  'internal-drive',
  'tail-thruster',
];

export function ControlDock({
  config,
  telemetry,
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapsed,
  onAnimationChange,
  onTogglePause,
  onSpeedChange,
  onJawOverrideChange,
  onTriggerJawSurge,
  onExplodedChange,
  onToggleInternalMachinery,
  onToggleWireframe,
  onToggleEngineeringGrid,
  onSelectComponent,
  onSelectSegment,
  onEnvironmentChange,
  onCameraPreset,
  onToggleAutoOrbit,
  onZoomStep,
}: ControlDockProps) {
  const activeSegmentIndex =
    config.inspection.selectedSegmentIndex ??
    COMPONENT_CATALOG[config.inspection.selectedComponent].segmentIndex;
  const segmentInfo = buildSegmentInfo(activeSegmentIndex, telemetry);
  const componentSpec = COMPONENT_CATALOG[config.inspection.selectedComponent];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div
        className={`w-full max-w-[1040px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'translate-y-[calc(100%-24px)]' : 'translate-y-0'
        }`}
      >
      {/* Centered collapse/expand drawer handle attached to top edge of dock */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="pointer-events-auto flex items-center gap-1.5 rounded-t border border-b-0 border-white/14 bg-[#121110]/94 px-4 py-1 text-xs font-medium text-stone-300 transition-colors hover:text-amber-300 whitespace-nowrap cursor-pointer"
        >
          {collapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Unified Bottom Engineering Dock — no backdrop-blur over WebGL */}
      <section
        aria-label="Sandwraith control dock"
        className="pointer-events-auto overflow-hidden rounded border border-white/14 bg-[#11100f]/94 shadow-2xl"
      >
        {/* Tab Row + Compact Live Headline Telemetry Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <nav
            aria-label="Control sections"
            className="flex items-center gap-1 overflow-x-auto sw-scroll"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-stone-950'
                      : 'text-stone-300 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Compact inline live readouts (clean unboxed tabular figures) */}
          <div className="hidden items-center gap-4 text-xs text-stone-400 xl:flex whitespace-nowrap">
            <div>
              <span>Core </span>
              <span className="font-mono tabular-nums font-medium text-amber-300">
                {telemetry.coreEnergyOutputGW.toFixed(2)} GW
              </span>
            </div>
            <span aria-hidden="true" className="text-stone-600">
              /
            </span>
            <div>
              <span>Hydraulics </span>
              <span className="font-mono tabular-nums font-medium text-stone-100">
                {telemetry.hydraulicPressureBar} bar
              </span>
            </div>
            <span aria-hidden="true" className="text-stone-600">
              /
            </span>
            <div>
              <span>Speed </span>
              <span className="font-mono tabular-nums font-medium text-stone-100">
                {telemetry.movementSpeedMs.toFixed(1)} m/s
              </span>
            </div>
          </div>
        </div>

        {/* Dock Body Content */}
        <div className="px-4 py-3.5">
          {/* 1. ANIMATION TAB */}
          {activeTab === 'animation' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {ANIMATION_MODES.map((mode) => {
                  const active = config.animationState === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      title={mode.summary}
                      onClick={() => onAnimationChange(mode.id)}
                      className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTriggerJawSurge}
                    className="rounded border border-amber-500/45 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Activate Jaw
                  </button>
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="flex items-center gap-1.5 rounded bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {config.isPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-white/8 pt-3 md:grid-cols-3">
                {/* Movement Speed Slider */}
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Movement Speed</span>
                    <span className="font-mono tabular-nums text-stone-100">
                      {config.speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.5}
                    step={0.05}
                    value={config.speed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    className="sw-slider w-full"
                  />
                </label>

                {/* Manual Jaw Aperture Slider */}
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Mechanical Jaw Aperture</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-amber-300">
                        {config.jawOverride === null
                          ? `Auto (${telemetry.jawAperturePct}%)`
                          : `${Math.round(config.jawOverride * 100)}%`}
                      </span>
                      {config.jawOverride !== null && (
                        <button
                          type="button"
                          onClick={() => onJawOverrideChange(null)}
                          className="text-[11px] text-stone-400 underline hover:text-white cursor-pointer"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.jawOverride ?? telemetry.jawAperturePct / 100}
                    onChange={(e) => onJawOverrideChange(Number(e.target.value))}
                    className="sw-slider w-full"
                  />
                </label>

                {/* Quick Exploded Slider right in Animation tab too for instant discovery */}
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Exploded Armor View</span>
                    <span className="font-mono tabular-nums text-stone-100">
                      {Math.round(config.inspection.explodedAmount * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.inspection.explodedAmount}
                    onChange={(e) => onExplodedChange(Number(e.target.value))}
                    className="sw-slider w-full"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 2. ENGINEERING TELEMETRY & CUTAWAY TAB */}
          {activeTab === 'engineering' && (
            <div className="space-y-3.5">
              {/* Telemetry Readout Grid (all requested dimensions & operational metrics) */}
              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-5">
                <TelemetryMetric label="Dimensions" value={`${telemetry.lengthM} m × ${telemetry.maxDiameterM} m`} />
                <TelemetryMetric label="Estimated Mass" value={`${telemetry.estimatedMassTons.toLocaleString()} t`} />
                <TelemetryMetric label="Active Segments" value={`${telemetry.segmentCount} units`} />
                <TelemetryMetric label="Hydraulic Pressure" value={`${telemetry.hydraulicPressureBar} bar`} accent />
                <TelemetryMetric label="Core Energy Output" value={`${telemetry.coreEnergyOutputGW.toFixed(2)} GW`} accent />
                <TelemetryMetric label="Structural Integrity" value={`${telemetry.structuralIntegrityPct.toFixed(1)}%`} />
                <TelemetryMetric label="Operating Temp" value={`${telemetry.operatingTempC} °C`} accent />
                <TelemetryMetric label="Movement Speed" value={`${telemetry.movementSpeedMs.toFixed(1)} m/s`} />
                <TelemetryMetric label="Power Consumption" value={`${telemetry.powerConsumptionMW} MW`} />
                <TelemetryMetric label="Crusher Turbine" value={`${telemetry.turbineRpm} RPM`} />
              </div>

              {/* Cutaway & Exploded Mechanical Controls */}
              <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-3">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-300 font-medium">Exploded Armor Separation</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {Math.round(config.inspection.explodedAmount * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.inspection.explodedAmount}
                    onChange={(e) => onExplodedChange(Number(e.target.value))}
                    className="sw-slider w-full"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <ToggleButton
                    label="Internal Machinery"
                    active={config.inspection.internalMachineryVisible}
                    onClick={onToggleInternalMachinery}
                  />
                  <ToggleButton
                    label="Wireframe Chassis"
                    active={config.inspection.wireframeChassis}
                    onClick={onToggleWireframe}
                  />
                  <ToggleButton
                    label="Calibration Grid"
                    active={config.inspection.showEngineeringGrid}
                    onClick={onToggleEngineeringGrid}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. COMPONENT & SEGMENT INSPECTOR TAB */}
          {activeTab === 'inspector' && (
            <div className="space-y-3">
              {/* Major Subsystem Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                {COMPONENT_LIST.map((cat) => {
                  const spec = COMPONENT_CATALOG[cat];
                  const isActive = config.inspection.selectedComponent === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => onSelectComponent(cat)}
                      className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {spec.name}
                    </button>
                  );
                })}
              </div>

              {/* Active Segment & Subsystem Inspection Breakdown */}
              <div className="grid grid-cols-1 gap-4 border-t border-white/8 pt-3 lg:grid-cols-12">
                <div className="space-y-1.5 lg:col-span-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-semibold tracking-wide text-stone-100">
                      {segmentInfo.label}
                    </h2>
                    <span className="font-mono text-xs tabular-nums text-amber-300 whitespace-nowrap">
                      Ø {segmentInfo.diameterM} m
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-300">
                    {segmentInfo.description}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    <span className="text-stone-300 font-medium">Alloy:</span> {segmentInfo.materialSpec}
                  </p>
                </div>

                {/* Live Segment Telemetry */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-white/8 sm:grid-cols-4 lg:col-span-4 lg:border-l lg:pl-4">
                  <TelemetryMetric label="Local Temp" value={`${segmentInfo.localTempC} °C`} accent />
                  <TelemetryMetric label="Actuator Load" value={`${segmentInfo.hydraulicBar} bar`} />
                  <TelemetryMetric label="Core Node" value={`${segmentInfo.coreOutputMW} MW`} />
                  <TelemetryMetric label="Integrity" value={`${segmentInfo.integrityPct}%`} />
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-[11px] leading-snug text-stone-400">
                      {componentSpec.engineeringNotes}
                    </p>
                  </div>
                </div>

                {/* Segment Scrubber + Camera Focus */}
                <div className="flex flex-col justify-between gap-2.5 border-white/8 lg:col-span-3 lg:border-l lg:pl-4">
                  <label className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">Inspect Segment</span>
                      <span className="font-mono tabular-nums text-stone-100">
                        #{activeSegmentIndex + 1} / {TOTAL_SEGMENTS}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={TOTAL_SEGMENTS - 1}
                      step={1}
                      value={activeSegmentIndex}
                      onChange={(e) => onSelectSegment(Number(e.target.value), false)}
                      className="sw-slider w-full"
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectSegment(activeSegmentIndex, true)}
                      className="flex-1 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
                    >
                      Focus Segment
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onExplodedChange(config.inspection.explodedAmount > 0.3 ? 0 : 0.75)
                      }
                      className="rounded border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:border-white/30 whitespace-nowrap cursor-pointer"
                    >
                      {config.inspection.explodedAmount > 0.3 ? 'Assemble' : 'Explode'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ENVIRONMENT SETTINGS TAB */}
          {activeTab === 'environment' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-stone-400">Time of Day</span>
                  {TIME_OF_DAY_PRESETS.map((tod) => {
                    const active = config.environment.timeOfDay === tod.id;
                    return (
                      <button
                        key={tod.id}
                        type="button"
                        onClick={() => onEnvironmentChange({ timeOfDay: tod.id as TimeOfDay })}
                        className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <span>{tod.label}</span>
                        <span className="ml-1.5 font-mono text-[11px] opacity-70">{tod.clock}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="flex min-w-[200px] flex-1 max-w-xs flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Sandstorm Intensity</span>
                    <span className="font-mono tabular-nums text-stone-100">
                      {Math.round(config.environment.sandstormIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={config.environment.sandstormIntensity}
                    onChange={(e) =>
                      onEnvironmentChange({
                        sandstormIntensity: Number(e.target.value),
                        sandstormEnabled: Number(e.target.value) > 0,
                      })
                    }
                    className="sw-slider w-full"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                <ToggleButton
                  label="Sandstorm Particles"
                  active={config.environment.sandstormEnabled}
                  onClick={() =>
                    onEnvironmentChange({ sandstormEnabled: !config.environment.sandstormEnabled })
                  }
                />
                <ToggleButton
                  label="Volumetric Lighting"
                  active={config.environment.volumetricLighting}
                  onClick={() =>
                    onEnvironmentChange({
                      volumetricLighting: !config.environment.volumetricLighting,
                    })
                  }
                />
                <ToggleButton
                  label="Atmospheric Fog"
                  active={config.environment.atmosphericFog}
                  onClick={() =>
                    onEnvironmentChange({ atmosphericFog: !config.environment.atmosphericFog })
                  }
                />
                <ToggleButton
                  label="Heat Shimmer"
                  active={config.environment.heatDistortion}
                  onClick={() =>
                    onEnvironmentChange({ heatDistortion: !config.environment.heatDistortion })
                  }
                />
                <ToggleButton
                  label="Sand Displacement"
                  active={config.environment.sandDisplacement}
                  onClick={() =>
                    onEnvironmentChange({ sandDisplacement: !config.environment.sandDisplacement })
                  }
                />
                <ToggleButton
                  label="Industrial Outposts"
                  active={config.environment.outpostStructures}
                  onClick={() =>
                    onEnvironmentChange({
                      outpostStructures: !config.environment.outpostStructures,
                    })
                  }
                />
              </div>
            </div>
          )}

          {/* 5. CAMERA CONTROLS TAB */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CAMERA_PRESETS.map((cam) => {
                    const active = config.cameraPreset === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => onCameraPreset(cam.id)}
                        className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {cam.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5">
                  <ToggleButton
                    label="Auto-Orbit"
                    active={config.autoOrbit}
                    onClick={onToggleAutoOrbit}
                  />
                  <button
                    type="button"
                    onClick={() => onZoomStep(0.8)}
                    aria-label="Zoom in"
                    className="flex items-center gap-1 rounded border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-stone-200 hover:border-white/30 whitespace-nowrap cursor-pointer"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                    <span>Zoom In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onZoomStep(1.25)}
                    aria-label="Zoom out"
                    className="flex items-center gap-1 rounded border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-stone-200 hover:border-white/30 whitespace-nowrap cursor-pointer"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                    <span>Zoom Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraPreset('cinematic')}
                    aria-label="Reset camera view"
                    className="flex items-center gap-1 rounded border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-stone-200 hover:border-white/30 whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5 text-xs text-stone-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Left-drag to orbit</span>
                  <span aria-hidden="true">·</span>
                  <span>Scroll to zoom</span>
                  <span aria-hidden="true">·</span>
                  <span>Right-drag to pan</span>
                  <span aria-hidden="true">·</span>
                  <span>Click any segment to inspect</span>
                </div>
                <div className="hidden items-center gap-2 font-mono text-[11px] text-stone-400 sm:flex">
                  <Sliders className="h-3 w-3 text-amber-400" />
                  <span>Shortcuts: Space Play/Pause · E Engineering · H Zen View · 1-7 States</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. CREATURE OVERVIEW DOSSIER TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
              <div className="space-y-1">
                <h3 className="font-display text-xs font-semibold tracking-wider text-amber-300">
                  Biomechanical Architecture
                </h3>
                <p className="leading-relaxed text-stone-300">
                  Sandwraith is a 242.4-meter autonomous subterranean leviathan articulated across
                  180 overlapping titanium and forged gunmetal segments. Quad-plate exterior armor
                  shells shed abrasive desert quartz while absorbing tectonic stress during deep
                  dune transit.
                </p>
              </div>
              <div className="space-y-1 border-white/8 md:border-l md:pl-4">
                <h3 className="font-display text-xs font-semibold tracking-wider text-amber-300">
                  Propulsion & Thermal Core
                </h3>
                <p className="leading-relaxed text-stone-300">
                  720 synchronized hydraulic articulation pistons drive travelling sinusoidal
                  locomotion waves. Distributed amber plasma junctions link every bulkhead to a
                  counter-rotating helical drive spine delivering up to 3.2 GW peak output.
                </p>
              </div>
              <div className="space-y-1 border-white/8 md:border-l md:pl-4">
                <h3 className="font-display text-xs font-semibold tracking-wider text-amber-300">
                  Excavation Maw & Telemetry
                </h3>
                <p className="leading-relaxed text-stone-300">
                  Six armored cowl petals shield three concentric tungsten-carbide tooth rings and
                  four hydraulic mandibles. Multi-spectral brow optics and seismic arrays track
                  distant acoustic thumpers through kilometer-scale desert basins.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

function TelemetryMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-stone-400 truncate">{label}</div>
      <div
        className={`font-mono text-sm font-medium tabular-nums truncate ${
          accent ? 'text-amber-300' : 'text-stone-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        active
          ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
          : 'border-white/12 bg-white/[0.03] text-stone-400 hover:border-white/25 hover:text-stone-200'
      }`}
    >
      {label}: {active ? 'On' : 'Off'}
    </button>
  );
}
