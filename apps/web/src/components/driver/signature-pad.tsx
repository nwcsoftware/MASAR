import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Proof-of-delivery signature (US-13). Upload to Storage lands in Phase 5. */
export function SignaturePad({ onChange }: { onChange: (hasInk: boolean) => void }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = getComputedStyle(canvas).color;
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        dir="ltr"
        className="h-32 w-full touch-none rounded-md border border-dashed border-border-strong bg-surface-2 text-fg"
        aria-label={t('driver.complete.signature')}
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d');
          const { x, y } = point(e);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          const { x, y } = point(e);
          ctx?.lineTo(x, y);
          ctx?.stroke();
          onChange(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const canvas = canvasRef.current;
          canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          onChange(false);
        }}
      >
        <Eraser aria-hidden="true" />
        {t('driver.complete.clear')}
      </Button>
    </div>
  );
}
