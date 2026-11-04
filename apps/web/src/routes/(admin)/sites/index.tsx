import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Building2, HardHat, MapPin, Plus, Star, Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { MapCanvas } from '@/components/map-canvas';
import { Page, Panel } from '@/components/page';
import { SiteFormSheet } from '@/components/sites/site-form-sheet';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useSites, type SiteWithAirports } from '@/features/sites/queries';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Enums } from '@/lib/database.types';

export const Route = createFileRoute('/(admin)/sites/')({
  component: SitesPage,
});

const SITE_TYPE_ICON: Record<Enums<'site_type'>, typeof Building2> = {
  office: Building2,
  construction_site: HardHat,
  warehouse: Warehouse,
  other: MapPin,
};

function SiteRow({ site }: { site: SiteWithAirports }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const Icon = SITE_TYPE_ICON[site.type];
  return (
    <li>
      <Link to="/sites/$siteId" params={{ siteId: site.id }} className="flex flex-wrap items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-200">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-40 flex-1">
          <span className="block font-bold">
            {name(site)} <span className="text-xs font-semibold text-fg-3">{site.code}</span>
          </span>
          <span className="block text-xs text-fg-2">
            {[t(`sites.type.${site.type}`), site.city].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {site.airports.map((sa) => (
            <span key={sa.airport_id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-fg-2">
              {sa.is_default && <Star className="size-3 fill-current text-warning-fg" aria-label={t('sites.defaultAirport')} />}
              {sa.airport.iata}
            </span>
          ))}
        </span>
        <span className="tabular w-24 text-xs text-fg-2">{t('sites.drivers', { count: site.driverCount })}</span>
        <span className="tabular w-24 text-xs text-fg-2">{t('sites.tasksToday', { count: site.tasksToday })}</span>
      </Link>
    </li>
  );
}

/** Screen 9 — sites list with airports. */
function SitesPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { profile } = useCurrentUser();
  const sites = useSites();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Page>
      <SiteFormSheet open={formOpen} onOpenChange={setFormOpen} onSaved={(siteId) => void navigate({ to: '/sites/$siteId', params: { siteId } })} />
      <PageHeader
        title={t('sites.title')}
        description={t('sites.subtitle')}
        actions={
          isAdmin(profile.role) && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              {t('sites.add')}
            </Button>
          )
        }
      />
      {sites.isError ? (
        <Panel>
          <ErrorState error={sites.error} onRetry={() => void sites.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel>
            {sites.isPending ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !sites.data.length ? (
              <EmptyState
                icon={Building2}
                title={t('sites.empty')}
                body={t('sites.emptyBody')}
                action={
                  isAdmin(profile.role) && (
                    <Button size="sm" onClick={() => setFormOpen(true)}>
                      <Plus aria-hidden="true" />
                      {t('sites.add')}
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {sites.data.map((site) => (
                  <SiteRow key={site.id} site={site} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            {sites.isPending ? (
              <Skeleton className="h-72 rounded-none" />
            ) : (
              <MapCanvas
                className="h-72 xl:h-full xl:min-h-72"
                pins={[
                  ...(sites.data ?? []).flatMap((s) =>
                    s.lat != null && s.lng != null ? [{ id: s.id, lat: s.lat, lng: s.lng, label: s.code ?? name(s), colorVar: 'var(--brand-500)', kind: 'site' as const }] : [],
                  ),
                  ...(sites.data ?? [])
                    .flatMap((s) => s.airports.map((a) => a.airport))
                    .filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i)
                    .map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, label: `✈ ${a.iata}`, colorVar: 'var(--cat-airport)', kind: 'airport' as const })),
                ]}
              />
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}
