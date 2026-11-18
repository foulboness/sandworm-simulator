import { Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import type { ViewMode } from '../types/sandwraith';

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  hudVisible: boolean;
  onToggleHud: () => void;
  hoveredSegmentIndex: number | null;
}

export function TopBar({
  viewMode,
  onViewModeChange,
  audioEnabled,
  onToggleAudio,
  hudVisible,
  onToggleHud,
  hoveredSegmentIndex,
}: TopBarProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-6 bg-gradient-to-b from-[#0b0a09]/80 via-[#0b0a09]/35 to-transparent px-5 py-3.5 sm:px-7">
      {/* Zone 1: Wordmark + quiet unboxed specification line */}
      <div className="pointer-events-auto flex items-baseline gap-4 min-w-0">
        <h1 className="font-display text-lg font-bold tracking-[0.14em] text-stone-100 whitespace-nowrap shrink-0 sm:text-xl">
          SANDWRAITH
        </h1>
        <div className="hidden items-center gap-2 text-xs text-stone-300/80 md:flex whitespace-nowrap">
          <span>Autonomous Mechanical Sandworm</span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="font-mono tabular-nums text-stone-200/90">180 Segments</span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="font-mono tabular-nums text-stone-200/90">242.4 m</span>
        </div>
      </div>

      {/* Transient non-intrusive hover hint when pointing at a 3D segment */}
      {hoveredSegmentIndex !== null && (
        <div className="hidden items-center gap-2 rounded border border-amber-500/35 bg-[#12100e]/92 px-3 py-1 text-xs text-amber-200 lg:flex whitespace-nowrap">
          <span className="font-mono tabular-nums font-medium">
            SEG-{String(hoveredSegmentIndex + 1).padStart(3, '0')}
          </span>
          <span aria-hidden="true" className="text-stone-500">
            ·
          </span>
          <span className="text-stone-300">Click segment to inspect</span>
        </div>
      )}

      {/* Zone 2: View Mode Switch + Audio + HUD visibility */}
      <div className="pointer-events-auto flex items-center gap-2.5 shrink-0">
        <div
          role="group"
          aria-label="Viewport mode"
          className="flex items-center rounded border border-white/12 bg-[#121110]/92 p-0.5"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('cinematic')}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'cinematic'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            Cinematic
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('engineering')}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'engineering'
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            Engineering
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleAudio}
          aria-pressed={audioEnabled}
          aria-label={audioEnabled ? 'Mute procedural audio' : 'Enable procedural audio'}
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            audioEnabled
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
              : 'border-white/12 bg-[#121110]/92 text-stone-300 hover:border-white/25 hover:text-white'
          }`}
        >
          {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{audioEnabled ? 'Sound On' : 'Sound Off'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleHud}
          aria-label={hudVisible ? 'Hide controls (H)' : 'Show controls (H)'}
          className="flex items-center gap-1.5 rounded border border-white/12 bg-[#121110]/92 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-white/25 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hudVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{hudVisible ? 'Zen View' : 'Show HUD'}</span>
        </button>
      </div>
    </header>
  );
}
