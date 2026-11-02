import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/features/auth/session';
import { useCompanySettings, useUpdateCompany } from '@/features/company/queries';
import { companyProfileSchema, type CompanyProfileValues } from '@/features/company/schema';

/** FR-01/61 company profile: names, country, time zone, language, Eastern Arabic digits. */
export function CompanyTab() {
  const { t } = useTranslation();
  const { company } = useCurrentUser();
  const settings = useCompanySettings();
  const update = useUpdateCompany();
  const form = useForm<CompanyProfileValues>({ resolver: zodResolver(companyProfileSchema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!company) return;
    form.reset({
      name: company.name,
      name_ar: company.name_ar ?? '',
      country_code: company.country_code,
      timezone: company.timezone,
      default_language: company.default_language,
      eastern_arabic_digits: settings.data?.eastern_arabic_digits ?? false,
    });
  }, [company, settings.data, form]);

  if (!company) return null;
  return (
    <form noValidate onSubmit={form.handleSubmit((values) => update.mutate(values, { onSuccess: () => form.reset(values) }))}>
      <Panel bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
        <Field id="company-name" label={t('settings.company.name')} error={errors.name?.message}>
          <Input id="company-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
        </Field>
        <Field id="company-name-ar" label={t('settings.company.nameAr')}>
          <Input id="company-name-ar" dir="rtl" {...form.register('name_ar')} />
        </Field>
        <Field id="company-tz" label={t('settings.company.timezone')} hint={t('settings.company.timezoneHint')} error={errors.timezone?.message}>
          <Input id="company-tz" dir="ltr" list="tz-options" {...form.register('timezone')} />
          <datalist id="tz-options">
            {['Asia/Riyadh', 'Asia/Dubai', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat', 'Africa/Cairo', 'Asia/Amman'].map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </Field>
        <Field id="company-country" label={t('settings.company.country')} error={errors.country_code?.message}>
          <Input id="company-country" dir="ltr" maxLength={2} className="uppercase" {...form.register('country_code')} />
        </Field>
        <Field id="company-lang" label={t('settings.company.language')}>
          <NativeSelect id="company-lang" {...form.register('default_language')}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold">
          <Switch
            checked={form.watch('eastern_arabic_digits') ?? false}
            onCheckedChange={(v) => form.setValue('eastern_arabic_digits', v, { shouldDirty: true })}
          />
          {t('settings.company.easternDigits')}
        </label>
        <FormError error={update.error} className="sm:col-span-2" />
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
          {update.isSuccess && !form.formState.isDirty && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-fg">
              <CircleCheck className="size-4" aria-hidden="true" />
              {t('common.saved')}
            </span>
          )}
        </div>
      </Panel>
    </form>
  );
}
