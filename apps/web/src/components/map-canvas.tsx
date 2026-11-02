import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { initials } from '@/lib/format';
import { cn, tone } from '@/lib/utils';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  colorVar: string;
  /** pulsing ring for drivers on the move */
  live?: boolean;
  kind?: 'driver' | 'site' | 'airport';
  selected?: boolean;
}

const MIN_SPAN = 0.25; // degrees — keeps a single pin from zooming to street level

/**
 * Phase 0 stand-in for LiveMap (Google Maps JS lands in Phase 4 with
 * @vis.gl/react-google-maps). Projects lat/lng into an illustrated canvas so
 * pins, colours and the driver panel can be designed against real data.
 * Geography never mirrors, so the canvas is always dir="ltr".
 */
export function MapCanvas({
  pins,
  className,
  onSelect,
  caption,
}: {
  pins: MapPin[];
  className?: string;
  onSelect?: (id: string) => void;
  caption?: string;
}) {
  const { t } = useTranslation();
  const bounds = useMemo(() => {
    if (!pins.length) return null;
    const lats = pins.map((p) => p.lat);
    const lngs = pins.map((p) => p.lng);
    const pad = (min: number, max: number) => (max - min < MIN_SPAN ? [min - MIN_SPAN / 2, max + MIN_SPAN / 2] : [min, max]);
    const [minLat = 0, maxLat = 0] = pad(Math.min(...lats), Math.max(...lats));
    const [minLng = 0, maxLng = 0] = pad(Math.min(...lngs), Math.max(...lngs));
    return { minLat, maxLat, minLng, maxLng };
  }, [pins]);
  const project = (lat: number, lng: number) =>
    bounds
      ? {
          x: 10 + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80,
          // pins hang above their point (-translate-y-full), so leave headroom at the top
          y: 24 + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 62,
        }
      : { x: 50, y: 50 };

  return (
    <div dir="ltr" className={cn('relative overflow-hidden bg-[var(--map-land)]', className)}>
      <svg className="absolute inset-0 size-full" viewBox="0 0 340 250" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 170 Q60 150 120 175 T260 160 T340 180 V250 H0Z" fill="var(--map-water)" />
        <g stroke="var(--map-road)" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-10 60 C80 40 140 90 220 70 S320 30 360 50" />
          <path d="M40 -10 C60 70 30 140 70 260" />
          <path d="M180 -10 C170 80 240 120 210 260" />
          <path d="M-10 120 C100 110 200 150 350 120" />
        </g>
        <g stroke="var(--map-road)" strokeWidth="2.5" fill="none">
          <path d="M0 30 H340M0 95 H340M0 210 H340M110 0 V250M290 0 V250" />
        </g>
      </svg>

      {pins.map((pin) => {
        const { x, y } = project(pin.lat, pin.lng);
        const isDriver = (pin.kind ?? 'driver') === 'driver';
        return (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelect?.(pin.id)}
            className={cn('absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5', pin.selected && 'z-10')}
            style={tone(pin.colorVar, { left: `${x}%`, top: `${y}%` })}
            aria-label={pin.label}
          >
            <span
              className={cn(
                'tone-dot grid place-items-center rounded-full border-[3px] border-surface text-[10px] font-extrabold text-fg-on-brand shadow-md',
                isDriver ? 'size-7' : 'size-5',
                pin.live && 'animate-pulse-ring',
                pin.selected && 'ring-2 ring-fg',
              )}
            >
              {isDriver ? initials(pin.label) : null}
            </span>
            <span className="whitespace-nowrap rounded-[6px] border border-border bg-surface px-1.5 py-px text-[10px] font-bold text-fg shadow-sm">
              {pin.label}
            </span>
          </button>
        );
      })}

      <span className="absolute bottom-2 end-2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-fg-3">
        {caption ?? t('map.placeholder')}
      </span>
    </div>
  );
}
