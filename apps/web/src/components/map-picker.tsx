import { useState } from 'react';
import { ClipboardPaste, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/form';
import { MapCanvas } from '@/components/map-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseCoordinates } from '@/lib/maps';

/**
 * docs/DESIGN.md §5 MapPicker (FR-02). Coordinates come from typing, a pasted
 * Google Maps link/coordinates, or the device location; the preview shows the
 * pin. The interactive Google map + Places search arrive with LiveMap (Phase 4).
 */
export function MapPicker({
  lat,
  lng,
  onChange,
  label,
  latError,
  lngError,
}: {
  lat: number;
  lng: number;
  onChange: (coords: { lat: number; lng: number }) => void;
  label: string;
  latError?: string;
  lngError?: string;
}) {
  const { t } = useTranslation();
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState(false);
  const [locating, setLocating] = useState(false);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <Field id="coords-paste" label={t('mapPicker.paste')} hint={t('mapPicker.pasteHint')} error={pasteError ? 'mapPicker.pasteError' : undefined}>
          <div className="flex gap-2">
            <Input
              id="coords-paste"
              dir="ltr"
              value={paste}
              placeholder="https://maps.google.com/…  ·  24.7136, 46.6753"
              onChange={(e) => {
                setPaste(e.target.value);
                setPasteError(false);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const coords = parseCoordinates(paste);
                if (!coords) return setPasteError(true);
                onChange(coords);
                setPaste('');
              }}
            >
              <ClipboardPaste aria-hidden="true" />
              {t('mapPicker.use')}
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="site-lat" label={t('onboarding.site.lat')} error={latError}>
            <Input
              id="site-lat"
              type="number"
              step="any"
              dir="ltr"
              className="tabular"
              value={Number.isFinite(lat) ? lat : ''}
              aria-invalid={Boolean(latError)}
              onChange={(e) => onChange({ lat: e.target.value === '' ? Number.NaN : Number(e.target.value), lng })}
            />
          </Field>
          <Field id="site-lng" label={t('onboarding.site.lng')} error={lngError}>
            <Input
              id="site-lng"
              type="number"
              step="any"
              dir="ltr"
              className="tabular"
              value={Number.isFinite(lng) ? lng : ''}
              aria-invalid={Boolean(lngError)}
              onChange={(e) => onChange({ lat, lng: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locating || !('geolocation' in navigator)}
          onClick={() => {
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                onChange({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
                setLocating(false);
              },
              () => setLocating(false),
              { enableHighAccuracy: true, timeout: 10_000 },
            );
          }}
        >
          <LocateFixed aria-hidden="true" />
          {locating ? t('common.loading') : t('onboarding.site.useLocation')}
        </Button>
      </div>
      <MapCanvas
        className="h-56 rounded-lg border border-border md:h-full md:min-h-56"
        caption={t('onboarding.site.mapCaption')}
        pins={valid ? [{ id: 'pin', lat, lng, label: label || t('onboarding.site.newSite'), colorVar: 'var(--brand-500)', kind: 'site' }] : []}
      />
    </div>
  );
}
