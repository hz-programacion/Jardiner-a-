import React, { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  clientName: string;
  dateStr?: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  clientName,
  dateStr,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(50);

  return (
    <div
      data-testid="interactive-before-after-slider"
      className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-stone-200/90 bg-stone-900 select-none group shadow-xs"
    >
      {/* Background: AFTER Photo (100% width) */}
      <img
        src={afterUrl}
        alt={`Después del servicio en ${clientName}`}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Foreground Clipped: BEFORE Photo */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={beforeUrl}
          alt={`Antes del servicio en ${clientName}`}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Top Labels (Clean scrim contrast) */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none z-10">
        <span className="px-2.5 py-1 rounded-md bg-stone-950/85 backdrop-blur-xs text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          Antes del Corte
        </span>
        <span className="px-2.5 py-1 rounded-md bg-stone-950/85 backdrop-blur-xs text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          Después del Corte{dateStr ? ` · ${dateStr}` : ''}
        </span>
      </div>

      {/* Vertical Divider Line & Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.65)] pointer-events-none z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-stone-900 border border-stone-300 shadow-md flex items-center justify-center transition-transform group-hover:scale-105">
          <MoveHorizontal className="w-4 h-4 text-emerald-800" />
        </div>
      </div>

      {/* Accessible Range Input Overlay */}
      <input
        type="range"
        min={5}
        max={95}
        value={sliderPosition}
        aria-label={`Deslizar para comparar foto antes y después de ${clientName}`}
        onChange={(e) => setSliderPosition(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20 m-0"
      />
    </div>
  );
}
