import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSites } from '@/features/sites/queries';
import { useSiteScope } from '@/features/sites/site-scope';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

/** docs/DESIGN.md §5 SiteSwitcher — "All sites" only for unscoped users. */
export function SiteSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { siteId, setSiteId, allowedSiteIds } = useSiteScope();
  const sites = useSites();
  const options = (sites.data ?? []).filter((s) => !allowedSiteIds.length || allowedSiteIds.includes(s.id));
  const current = options.find((s) => s.id === siteId);
  const canSeeAll = allowedSiteIds.length === 0;
  const label = current ? name(current) : canSeeAll ? t('common.allSites') : t('sites.mySites');
  const sub = current ? (current.code ?? '') : t('sites.count', { count: options.length });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md border border-border bg-surface p-2 text-start transition-colors hover:border-border-strong',
          collapsed && 'justify-center',
        )}
        aria-label={t('sites.switch')}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand-100 text-xs font-extrabold text-brand-600 dark:bg-brand-900 dark:text-brand-200">
          {current?.code ?? <Building2 className="size-4" aria-hidden="true" />}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-fg">{label}</span>
              <span className="block truncate text-xs text-fg-3">{sub}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('sites.switch')}</DropdownMenuLabel>
        {canSeeAll && (
          <>
            <DropdownMenuItem onSelect={() => setSiteId(null)}>
              <Building2 aria-hidden="true" />
              <span className="flex-1">{t('common.allSites')}</span>
              {!siteId && <Check className="!text-brand-500" aria-hidden="true" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((site) => (
          <DropdownMenuItem key={site.id} onSelect={() => setSiteId(site.id)}>
            <span className="w-8 text-xs font-bold text-fg-3">{site.code}</span>
            <span className="flex-1 truncate">{name(site)}</span>
            {siteId === site.id && <Check className="!text-brand-500" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
