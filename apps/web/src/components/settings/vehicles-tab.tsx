import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Car, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError, NativeSelect } from '@/components/form';
import { GradeBadge, GroupSelect } from '@/components/grade-badge';
import { Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSaveVehicle, useVehicles } from '@/features/company/queries';
import { vehicleSchema, type VehicleValues } from '@/features/company/schema';
import { useGradeGroups } from '@/features/grades/queries';
import { useSites } from '@/features/sites/queries';
import type { Vehicle } from '@/mocks/fixtures';
import { formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

const DEFAULTS: VehicleValues = { plate_no: '', make: '', model: '', year: null, color: '', seats: 4, site_id: '', grade_group_id: '', odometer_km: 0, is_active: true, notes: '' };

function VehicleSheet({ open, onOpenChange, vehicle }: { open: boolean; onOpenChange: (open: boolean) => void; vehicle?: Vehicle }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const sites = useSites();
  const save = useSaveVehicle();
  const groups = useGradeGroups();
  const form = useForm<VehicleValues>({ resolver: zodResolver(vehicleSchema), defaultValues: DEFAULTS });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    form.reset(
      vehicle
        ? {
            plate_no: vehicle.plate_no,
            make: vehicle.make ?? '',
            model: vehicle.model ?? '',
            year: vehicle.year,
            color: vehicle.color ?? '',
            seats: vehicle.seats ?? 4,
            site_id: vehicle.site_id ?? '',
            grade_group_id: vehicle.grade_group_id ?? '',
            odometer_km: vehicle.odometer_km ?? 0,
            is_active: vehicle.is_active,
            notes: vehicle.notes ?? '',
          }
        : DEFAULTS,
    );
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  // react-hook-form also passes the (null) default through setValueAs
  const num = (v: string | null | undefined) => (v === '' || v == null ? null : Number(v));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{vehicle ? t('vehicles.edit') : t('vehicles.add')}</SheetTitle>
          <SheetDescription>{t('vehicles.hint')}</SheetDescription>
        </SheetHeader>
        <form
          id="vehicle-form"
          noValidate
          className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => save.mutate({ id: vehicle?.id, values }, { onSuccess: () => onOpenChange(false) }))}
        >
          <Field id="veh-plate" label={t('vehicles.plate')} error={errors.plate_no?.message} className="sm:col-span-2">
            <Input id="veh-plate" dir="ltr" className="uppercase" aria-invalid={Boolean(errors.plate_no)} {...form.register('plate_no')} />
          </Field>
          <Field id="veh-make" label={t('vehicles.make')}>
            <Input id="veh-make" {...form.register('make')} />
          </Field>
          <Field id="veh-model" label={t('vehicles.model')}>
            <Input id="veh-model" {...form.register('model')} />
          </Field>
          <Field id="veh-year" label={t('vehicles.year')} error={errors.year?.message}>
            <Input id="veh-year" type="number" dir="ltr" {...form.register('year', { setValueAs: num })} />
          </Field>
          <Field id="veh-color" label={t('vehicles.color')}>
            <Input id="veh-color" {...form.register('color')} />
          </Field>
          <Field id="veh-seats" label={t('vehicles.seats')} error={errors.seats?.message}>
            <Input id="veh-seats" type="number" dir="ltr" {...form.register('seats', { valueAsNumber: true })} />
          </Field>
          <Field id="veh-odo" label={t('vehicles.odometer')} error={errors.odometer_km?.message}>
            <Input id="veh-odo" type="number" dir="ltr" {...form.register('odometer_km', { valueAsNumber: true })} />
          </Field>
          <Field id="veh-site" label={t('vehicles.site')} className="sm:col-span-2">
            <NativeSelect id="veh-site" {...form.register('site_id')}>
              <option value="">—</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {(groups.data ?? []).length > 0 && (
            <Field id="veh-group" label={t('vehicles.gradeGroup')} hint={t('vehicles.gradeGroupHint')} className="sm:col-span-2">
              <GroupSelect id="veh-group" groups={groups.data ?? []} emptyLabel={t('vehicles.anyGroup')} {...form.register('grade_group_id')} />
            </Field>
          )}
          {vehicle && (
            <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
              <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v, { shouldDirty: true })} />
              {t('common.active')}
            </label>
          )}
          <FormError error={save.error} className="sm:col-span-2" />
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="vehicle-form" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** FR-05 vehicles. */
export function VehiclesTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const vehicles = useVehicles();
  const sites = useSites();
  const groups = useGradeGroups();
  const [editing, setEditing] = useState<Vehicle | undefined>();
  const [open, setOpen] = useState(false);
  const siteName = (id: string | null) => {
    const site = sites.data?.find((s) => s.id === id);
    return site ? name(site) : '—';
  };

  return (
    <Panel
      title={t('vehicles.title')}
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          {t('vehicles.add')}
        </Button>
      }
    >
      <VehicleSheet open={open} onOpenChange={setOpen} vehicle={editing} />
      {vehicles.isPending ? (
        <Skeleton className="m-4 h-32" />
      ) : vehicles.isError ? (
        <ErrorState error={vehicles.error} onRetry={() => void vehicles.refetch()} />
      ) : !vehicles.data.length ? (
        <EmptyState compact icon={Car} title={t('vehicles.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('vehicles.plate')}</TableHead>
              <TableHead>{t('vehicles.vehicle')}</TableHead>
              <TableHead>{t('vehicles.seats')}</TableHead>
              <TableHead>{t('vehicles.gradeGroup')}</TableHead>
              <TableHead>{t('vehicles.site')}</TableHead>
              <TableHead>{t('vehicles.odometer')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.data.map((v) => (
              <TableRow key={v.id} className={v.is_active ? undefined : 'opacity-60'}>
                <TableCell className="font-semibold" dir="ltr">
                  {v.plate_no}
                </TableCell>
                <TableCell>
                  {[v.make, v.model, v.year].filter(Boolean).join(' ')}
                  {!v.is_active && <Badge className="ms-2">{t('common.inactive')}</Badge>}
                </TableCell>
                <TableCell className="tabular">{v.seats}</TableCell>
                <TableCell>
                  {v.grade_group_id ? <GradeBadge code={groups.data?.find((g) => g.id === v.grade_group_id)?.code} /> : <span className="text-fg-3">—</span>}
                </TableCell>
                <TableCell>{siteName(v.site_id)}</TableCell>
                <TableCell className="tabular">{t('units.km', { value: formatNumber(v.odometer_km ?? 0, 0) })}</TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      setEditing(v);
                      setOpen(true);
                    }}
                    aria-label={`${t('common.edit')} ${v.plate_no}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
