import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SignaturePad } from '@/components/driver/signature-pad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useTaskTransition } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';

/** Complete sheet — odometer, notes, photo; signature for document delivery (FR-30, US-13). */
export function CompleteSheet({ task, open, onOpenChange }: { task: TaskWithRelations; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const transition = useTaskTransition();
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  // Object URL for the photo preview; the File itself is uploaded to Storage in Phase 5 (US-13).
  const [preview, setPreview] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const needsSignature = task.category === 'document_delivery';

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md">
        <SheetHeader>
          <SheetTitle>{t('driver.complete.title')}</SheetTitle>
          <SheetDescription>{task.title}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-5">
          <div className="space-y-1.5">
            <Label htmlFor="odometer">{t('driver.complete.odometer')}</Label>
            <Input id="odometer" type="number" inputMode="numeric" dir="ltr" className="tabular" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="complete-notes">{t('driver.complete.notes')}</Label>
            <Textarea id="complete-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">{t('driver.complete.photo')}</span>
            <label className="touch-target flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 p-3 text-sm font-semibold text-fg-2">
              {preview ? <img src={preview} alt="" className="max-h-32 rounded" /> : <Camera className="size-5" aria-hidden="true" />}
              {!preview && t('driver.complete.takePhoto')}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
          </div>
          {needsSignature && (
            <div className="space-y-1.5">
              <span className="text-sm font-semibold">{t('driver.complete.signature')}</span>
              <SignaturePad onChange={setSigned} />
            </div>
          )}
          <p className="text-xs text-fg-3">{t('driver.complete.uploadNote')}</p>
          {transition.isError && <p className="text-sm font-semibold text-danger">{transition.error.message}</p>}
        </div>
        <SheetFooter>
          <Button
            size="hero"
            className="bg-status-completed hover:bg-status-completed hover:opacity-90"
            disabled={transition.isPending || (needsSignature && !signed)}
            onClick={() =>
              transition.mutate(
                {
                  taskId: task.id,
                  action: 'complete',
                  payload: { notes: notes || undefined, odometer_km: odometer ? Number(odometer) : undefined },
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {t('driver.actions.complete')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
