import { useTranslation } from 'react-i18next';
import { cn, tone } from '@/lib/utils';
import { CATEGORY_ICON, categoryColorVar, type TaskCategory } from '@/lib/task-meta';

/** Category is never colour alone: icon + label (docs/DESIGN.md §8). */
export function CategoryBadge({ category, compact, className }: { category: TaskCategory; compact?: boolean; className?: string }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={cn('tone-text inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold', className)}
      style={tone(categoryColorVar(category))}
      title={compact ? t(`tasks.category.${category}`) : undefined}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {compact ? <span className="sr-only">{t(`tasks.category.${category}`)}</span> : t(`tasks.category.${category}`)}
    </span>
  );
}
