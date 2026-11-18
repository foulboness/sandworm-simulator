import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANIMATION_MODES,
  buildSegmentInfo,
  COMPONENT_CATALOG,
  TOTAL_SEGMENTS,
  type AnimationState,
  type CameraPreset,
  type ComponentCategory,
  type DockTab,
  type EnvironmentSettings,
  type SimulationConfig,
  type TelemetryData,
  type ViewMode,
} from './types/sandwraith';
import { SandwraithViewport } from './scene/SandwraithViewport';
import { TopBar } from './components/TopBar';
import { ControlDock } from './components/ControlDock';

const INITIAL_CONFIG: SimulationConfig = {
  viewMode: 'cinematic',
  animationState: 'emergence',
  isPaused: false,
  speed: 1.0,
  jawOverride: null,
  jawSurgeNonce: 0,
  cameraPreset: 'cinematic',
  cameraNonce: 0,
  autoOrbit: false,
  zoomStepNonce: 0,
  zoomDelta: 1,
  environment: {
    timeOfDay: 'golden',
    sandstormIntensity: 0.42,
    sandstormEnabled: true,
    volumetricLighting: true,
    atmosphericFog: true,
    heatDistortion: true,
    sandDisplacement: true,
    outpostStructures: true,
  },
  inspection: {
    explodedAmount: 0,
    internalMachineryVisible: false,
    wireframeChassis: false,
    showEngineeringGrid: false,
    selectedSegmentIndex: null,
    selectedComponent: 'maw',
  },
};

const INITIAL_TELEMETRY: TelemetryData = {
  lengthM: 242.4,
  maxDiameterM: 11.8,
  estimatedMassTons: 48600,
  segmentCount: TOTAL_SEGMENTS,
  hydraulicPressureBar: 382,
  coreEnergyOutputGW: 2.48,
  structuralIntegrityPct: 98.6,
  operatingTempC: 912,
  movementSpeedMs: 18.4,
  powerConsumptionMW: 2095,
  jawAperturePct: 36,
  subsurfaceDepthM: 0,
  turbineRpm: 68,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<SandwraithViewport | null>(null);

  const [config, setConfig] = useState<SimulationConfig>(INITIAL_CONFIG);
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [activeTab, setActiveTab] = useState<DockTab>('animation');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Store latest telemetry ref for click callback classification
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  // Initialize Three.js WebGL viewport once in isolated empty mount container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let vp: SandwraithViewport | null = null;
    try {
      vp = new SandwraithViewport(container, INITIAL_CONFIG, {
        onTelemetry: (nextTelemetry) => {
          setTelemetry(nextTelemetry);
        },
        onSegmentSelect: (segIdx) => {
          const info = buildSegmentInfo(segIdx, telemetryRef.current);
          setConfig((prev) => ({
            ...prev,
            inspection: {
              ...prev.inspection,
              selectedSegmentIndex: segIdx,
              selectedComponent: info.category,
            },
          }));
          setActiveTab('inspector');
          setDockCollapsed(false);
        },
        onSegmentHover: (segIdx) => {
          setHoveredSegmentIndex(segIdx);
        },
        onContextLost: (lost) => {
          setWebglError(
            lost
              ? 'WebGL graphics context was interrupted. Attempting recovery.'
              : null,
          );
        },
      });
      viewportRef.current = vp;
    } catch {
      setWebglError(
        'WebGL rendering is unavailable in this browser environment.',
      );
    }

    return () => {
      vp?.dispose();
      viewportRef.current = null;
    };
  }, []);

  // Push config updates into running Three.js engine without tearing down WebGL
  useEffect(() => {
    viewportRef.current?.updateConfig(config);
  }, [config]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setConfig((prev) => ({
      ...prev,
      viewMode: mode,
      cameraPreset: mode === 'engineering' ? 'engineering' : 'cinematic',
      cameraNonce: prev.cameraNonce + 1,
      inspection: {
        ...prev.inspection,
        showEngineeringGrid: mode === 'engineering',
      },
    }));
    setActiveTab(mode === 'engineering' ? 'engineering' : 'animation');
    setDockCollapsed(false);
  }, []);

  const handleAnimationChange = useCallback((state: AnimationState) => {
    setConfig((prev) => ({
      ...prev,
      animationState: state,
      isPaused: false,
    }));
  }, []);

  const handleTogglePause = useCallback(() => {
    setConfig((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setConfig((prev) => ({ ...prev, speed }));
  }, []);

  const handleJawOverrideChange = useCallback((jawOverride: number | null) => {
    setConfig((prev) => ({ ...prev, jawOverride }));
  }, []);

  const handleTriggerJawSurge = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      jawOverride: null,
      jawSurgeNonce: prev.jawSurgeNonce + 1,
    }));
  }, []);

  const handleExplodedChange = useCallback((explodedAmount: number) => {
    setConfig((prev) => ({
      ...prev,
      inspection: { ...prev.inspection, explodedAmount },
    }));
  }, []);

  const handleToggleInternalMachinery = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      inspection: {
        ...prev.inspection,
        internalMachineryVisible: !prev.inspection.internalMachineryVisible,
      },
    }));
  }, []);

  const handleToggleWireframe = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      inspection: {
        ...prev.inspection,
        wireframeChassis: !prev.inspection.wireframeChassis,
      },
    }));
  }, []);

  const handleToggleEngineeringGrid = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      inspection: {
        ...prev.inspection,
        showEngineeringGrid: !prev.inspection.showEngineeringGrid,
      },
    }));
  }, []);

  const handleSelectComponent = useCallback((cat: ComponentCategory) => {
    const spec = COMPONENT_CATALOG[cat];
    setConfig((prev) => ({
      ...prev,
      cameraPreset: cat === 'maw' || cat === 'mandibles' ? 'maw' : cat === 'tail-thruster' ? 'tail' : 'segment',
      cameraNonce: prev.cameraNonce + 1,
      inspection: {
        ...prev.inspection,
        selectedComponent: cat,
        selectedSegmentIndex: spec.segmentIndex,
      },
    }));
  }, []);

  const handleSelectSegment = useCallback((index: number, focusCamera = false) => {
    const info = buildSegmentInfo(index, telemetryRef.current);
    setConfig((prev) => ({
      ...prev,
      cameraPreset: focusCamera ? 'segment' : prev.cameraPreset,
      cameraNonce: focusCamera ? prev.cameraNonce + 1 : prev.cameraNonce,
      inspection: {
        ...prev.inspection,
        selectedSegmentIndex: index,
        selectedComponent: info.category,
      },
    }));
  }, []);

  const handleEnvironmentChange = useCallback((patch: Partial<EnvironmentSettings>) => {
    setConfig((prev) => ({
      ...prev,
      environment: { ...prev.environment, ...patch },
    }));
  }, []);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setConfig((prev) => ({
      ...prev,
      cameraPreset: preset,
      cameraNonce: prev.cameraNonce + 1,
    }));
  }, []);

  const handleToggleAutoOrbit = useCallback(() => {
    setConfig((prev) => ({ ...prev, autoOrbit: !prev.autoOrbit }));
  }, []);

  const handleZoomStep = useCallback((factor: number) => {
    setConfig((prev) => ({
      ...prev,
      zoomDelta: factor,
      zoomStepNonce: prev.zoomStepNonce + 1,
    }));
  }, []);

  const handleToggleAudio = useCallback(() => {
    if (!viewportRef.current) return;
    const isOn = viewportRef.current.sound.toggle();
    setAudioEnabled(isOn);
  }, []);

  // Global keyboard shortcuts (H = Zen mode, Space = Pause/Resume, E = Engineering, 1-7 = Animations)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.code === 'KeyE') {
        setConfig((prev) => {
          const nextMode: ViewMode =
            prev.viewMode === 'engineering' ? 'cinematic' : 'engineering';
          setActiveTab(nextMode === 'engineering' ? 'engineering' : 'animation');
          return {
            ...prev,
            viewMode: nextMode,
            cameraPreset: nextMode === 'engineering' ? 'engineering' : 'cinematic',
            cameraNonce: prev.cameraNonce + 1,
            inspection: {
              ...prev.inspection,
              showEngineeringGrid: nextMode === 'engineering',
            },
          };
        });
      } else if (e.key >= '1' && e.key <= '7') {
        const idx = Number(e.key) - 1;
        const mode = ANIMATION_MODES[idx];
        if (mode) handleAnimationChange(mode.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnimationChange, handleTogglePause]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0a09] select-none">
      {/* Isolated Full-Viewport WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 h-full w-full"
        aria-label="Sandwraith 3D Interactive Viewport"
      />

      {/* Graceful WebGL Fallback Surface */}
      {webglError && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0d0c0b] p-6">
          <div className="max-w-md rounded border border-amber-500/35 bg-[#151311] p-6 text-center">
            <h2 className="font-display text-lg font-semibold tracking-wider text-amber-300">
              SANDWRAITH 3D VIEWPORT
            </h2>
            <p className="mt-2 text-sm text-stone-300">{webglError}</p>
          </div>
        </div>
      )}

      {/* Minimal Top Bar */}
      <TopBar
        viewMode={config.viewMode}
        onViewModeChange={handleViewModeChange}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        hudVisible={!dockCollapsed}
        onToggleHud={() => setDockCollapsed((prev) => !prev)}
        hoveredSegmentIndex={hoveredSegmentIndex}
      />

      {/* Unified Collapsible Bottom Engineering Dock */}
      <ControlDock
        config={config}
        telemetry={telemetry}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed((prev) => !prev)}
        onAnimationChange={handleAnimationChange}
        onTogglePause={handleTogglePause}
        onSpeedChange={handleSpeedChange}
        onJawOverrideChange={handleJawOverrideChange}
        onTriggerJawSurge={handleTriggerJawSurge}
        onExplodedChange={handleExplodedChange}
        onToggleInternalMachinery={handleToggleInternalMachinery}
        onToggleWireframe={handleToggleWireframe}
        onToggleEngineeringGrid={handleToggleEngineeringGrid}
        onSelectComponent={handleSelectComponent}
        onSelectSegment={handleSelectSegment}
        onEnvironmentChange={handleEnvironmentChange}
        onCameraPreset={handleCameraPreset}
        onToggleAutoOrbit={handleToggleAutoOrbit}
        onZoomStep={handleZoomStep}
      />
    </main>
  );
}
