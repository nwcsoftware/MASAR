import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CATEGORY_ICON, categoryColorVar, TASK_CATEGORIES, type TaskCategory } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

const STEPS = ['category', 'details', 'stops', 'schedule', 'assign', 'review'] as const;

/**
 * TaskWizard shell (docs/DESIGN.md §5): step 1 (CategoryStep) is live so the
 * flow can be reviewed; the remaining steps arrive with Phase 2 (FR-10…16).
 */
export function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TaskCategory | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCategory(null);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('wizard.title')}</DialogTitle>
          <DialogDescription>{t('wizard.subtitle')}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-1.5 text-xs font-semibold" aria-label={t('wizard.steps')}>
          {STEPS.map((step, i) => (
            <li
              key={step}
              className={cn('rounded-full px-2.5 py-1', i === 0 ? 'bg-brand-500 text-fg-on-brand' : 'bg-surface-2 text-fg-3')}
              aria-current={i === 0 ? 'step' : undefined}
            >
              {i + 1}. {t(`wizard.step.${step}`)}
            </li>
          ))}
        </ol>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('wizard.step.category')}>
          {TASK_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const selected = category === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCategory(c)}
                className={cn(
                  'tone-block flex items-start gap-3 rounded-lg p-4 text-start transition-shadow hover:shadow-md',
                  selected && 'ring-2 ring-brand-500',
                )}
                style={tone(categoryColorVar(c))}
              >
                <span className="tone-text mt-0.5">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-fg">{t(`tasks.category.${c}`)}</span>
                  <span className="block text-xs text-fg-2">{t(`wizard.categoryHint.${c}`)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-fg-3">{t('wizard.phaseNote')}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled title={t('common.comingSoon')}>
              {t('common.next')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
