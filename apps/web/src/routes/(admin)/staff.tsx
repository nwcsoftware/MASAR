import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Contact, FileUp, Layers, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { GradeBadge } from '@/components/grade-badge';
import { ImportPeopleDialog } from '@/components/people/import-dialog';
import { PersonFormDialog } from '@/components/people/person-form-dialog';
import { RegistrationsPanel } from '@/components/people/registrations-panel';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAdmin, isStaff } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useGradeGroups } from '@/features/grades/queries';
import { groupForGrade } from '@/features/grades/rules';
import { usePeople } from '@/features/people/queries';
import { useSites } from '@/features/sites/queries';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Person } from '@/mocks/fixtures';

interface StaffSearch {
  q?: string;
  group?: string;
}

export const Route = createFileRoute('/(admin)/staff')({
  validateSearch: (search: Record<string, unknown>): StaffSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    group: typeof search.group === 'string' && search.group ? search.group : undefined,
  }),
  component: StaffPage,
});

const ALL = '__all';

/** Staff directory (0004): who may travel, with their grade and group. Filled from Excel. */
function StaffPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const people = usePeople();
  const groups = useGradeGroups();
  const sites = useSites();
  const staff = isStaff(user.profile.role);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Person | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  const groupOf = (p: Person) => groupForGrade(groups.data ?? [], p.grade);
  const q = search.q?.trim().toLowerCase();
  const rows = (people.data ?? [])
    .filter((p) => !search.group || groupOf(p)?.id === search.group)
    .filter(
      (p) =>
        !q ||
        [p.full_name, p.full_name_ar, p.employee_no, p.job_title, p.department].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  const setSearch = (patch: Partial<StaffSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const filtered = Boolean(search.q || search.group);

  const columns = useMemo<ColumnDef<Person, unknown>[]>(
    () => [
      {
        id: 'employee_no',
        accessorFn: (p) => p.employee_no ?? '',
        header: () => t('people.fields.employee_no'),
        meta: { label: t('people.fields.employee_no'), csv: (p) => p.employee_no, className: 'whitespace-nowrap' },
        cell: ({ row }) => <span dir="ltr">{row.original.employee_no ?? '—'}</span>,
      },
      {
        id: 'name',
        accessorFn: (p) => p.full_name,
        header: () => t('people.fields.full_name'),
        meta: { label: t('people.fields.full_name'), csv: (p) => p.full_name },
        cell: ({ row }) => (
          <div className="min-w-44">
            <div className="font-semibold">{name(row.original, 'full_name')}</div>
            {row.original.job_title && <div className="text-xs text-fg-3">{row.original.job_title}</div>}
          </div>
        ),
      },
      {
        id: 'grade',
        accessorFn: (p) => p.grade ?? -1,
        header: () => t('people.fields.grade'),
        meta: { label: t('people.fields.grade'), csv: (p) => p.grade },
        cell: ({ row }) =>
          row.original.grade == null ? (
            <span className="text-xs font-semibold text-warning-fg">{t('people.noGrade')}</span>
          ) : (
            <GradeBadge code={groupForGrade(groups.data ?? [], row.original.grade)?.code} grade={row.original.grade} />
          ),
      },
      {
        id: 'department',
        accessorFn: (p) => p.department ?? '',
        header: () => t('people.fields.department'),
        meta: { label: t('people.fields.department'), csv: (p) => p.department },
      },
      {
        id: 'site',
        accessorFn: (p) => sites.data?.find((s) => s.id === p.site_id)?.name ?? '',
        header: () => t('people.fields.site'),
        meta: { label: t('people.fields.site'), csv: (p) => sites.data?.find((s) => s.id === p.site_id)?.name },
        cell: ({ row }) => {
          const site = sites.data?.find((s) => s.id === row.original.site_id);
          return <span className="whitespace-nowrap">{site ? name(site) : '—'}</span>;
        },
      },
      {
        id: 'phone',
        accessorFn: (p) => p.phone ?? '',
        header: () => t('people.fields.phone'),
        meta: { label: t('people.fields.phone'), csv: (p) => p.phone },
        cell: ({ row }) => (
          <span className="tabular whitespace-nowrap" dir="ltr">
            {row.original.phone ?? '—'}
            {!row.original.is_active && <Badge className="ms-2">{t('common.inactive')}</Badge>}
            {row.original.registration_status && <Badge className="ms-2">{t(`passenger.account.${row.original.registration_status}`)}</Badge>}
          </span>
        ),
      },
    ],
    [t, name, groups.data, sites.data],
  );

  return (
    <Page>
      <PageHeader
        title={t('people.title')}
        description={t('people.subtitle')}
        actions={
          staff && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <FileUp aria-hidden="true" />
                {t('people.import.open')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                {t('people.add')}
              </Button>
            </>
          )
        }
      />

      {groups.isSuccess && !groups.data.length && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
          <Layers className="size-5 text-brand-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-fg-2">{t('grades.notSetUp')}</span>
          {isAdmin(user.profile.role) && (
            <Button asChild size="sm" variant="outline">
              <Link to="/settings" search={{ tab: 'grades' }}>
                {t('grades.setUp')}
              </Link>
            </Button>
          )}
        </div>
      )}

      {isAdmin(user.profile.role) && <RegistrationsPanel people={people.data ?? []} />}

      <Panel>
        {people.isError ? (
          <ErrorState error={people.error} onRetry={() => void people.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            loading={people.isPending}
            getRowId={(p) => p.id}
            onRowClick={
              staff
                ? (p) => {
                    setEditing(p);
                    setFormOpen(true);
                  }
                : undefined
            }
            csvFilename="masar-staff.csv"
            toolbar={
              <>
                <form
                  className="relative w-full sm:w-64"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = new FormData(event.currentTarget).get('q');
                    setSearch({ q: typeof value === 'string' && value.trim() ? value.trim() : undefined });
                  }}
                >
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                  <Input key={search.q} name="q" defaultValue={search.q} placeholder={t('people.search')} aria-label={t('people.search')} className="h-9 ps-9" />
                </form>
                {(groups.data ?? []).length > 0 && (
                  <Select value={search.group ?? ALL} onValueChange={(v) => setSearch({ group: v === ALL ? undefined : v })}>
                    <SelectTrigger className="h-9 w-40" aria-label={t('people.filterGroup')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('people.allGroups')}</SelectItem>
                      {(groups.data ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.code}
                          {g.name ? ` · ${name(g)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filtered && (
                  <Button variant="ghost" size="sm" onClick={() => void navigate({ search: {} })}>
                    {t('tasks.filters.clear')}
                  </Button>
                )}
              </>
            }
            empty={
              <EmptyState
                icon={Contact}
                title={filtered ? t('people.emptyFiltered') : t('people.empty')}
                body={filtered ? undefined : t('people.emptyBody')}
                action={
                  !filtered && staff ? (
                    <Button size="sm" onClick={() => setImportOpen(true)}>
                      <FileUp aria-hidden="true" />
                      {t('people.import.open')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </Panel>

      <ImportPeopleDialog open={importOpen} onOpenChange={setImportOpen} />
      <PersonFormDialog open={formOpen} onOpenChange={setFormOpen} person={editing} />
    </Page>
  );
}
