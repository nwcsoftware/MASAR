import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession, useSessionApi } from '@/features/auth/session';
import { registerDemoPassenger } from '@/features/passenger/queries';
import { passengerSignUpSchema, type PassengerSignUpValues } from '@/features/passenger/schema';
import { AppError, db } from '@/lib/data-source';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(auth)/register')({
  component: RegisterPage,
});

/**
 * §1 passenger sign-up. Live: Supabase Auth sign-up, then
 * rpc_passenger_register attaches the account to the company (pending until
 * an owner/admin approves). If Auth asks for e-mail confirmation first, the
 * passenger returns here signed in and only finishes the second step.
 */
function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const { isSupabase, signUp, signInDemoUser, refresh } = useSessionApi();
  const signedIn = session.status === 'signed-in';
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<PassengerSignUpValues>({
    resolver: zodResolver(passengerSignUpSchema),
    defaultValues: {
      fullName: signedIn ? session.user.profile.full_name : '',
      email: signedIn ? (session.user.email ?? '') : '',
      password: '',
      phone: '',
      method: 'email',
      employeeNo: '',
      joinCode: '',
      language: i18n.language.startsWith('ar') ? 'ar' : 'en',
      needsPassword: !signedIn,
    },
  });
  const errors = form.formState.errors;
  const method = form.watch('method');

  const attach = async (v: PassengerSignUpValues) => {
    const { error: rpcError } = await db().rpc('rpc_passenger_register', {
      p_full_name: v.fullName,
      p_phone: v.phone || undefined,
      p_employee_no: v.method === 'employee' ? v.employeeNo : undefined,
      p_join_code: v.method === 'employee' ? v.joinCode : undefined,
      p_language: v.language,
    });
    if (rpcError) throw new AppError(rpcError.message);
    await refresh();
    void navigate({ to: '/passenger' });
  };

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      if (!isSupabase) {
        const id = registerDemoPassenger({ email: v.email, fullName: v.fullName, phone: v.phone, employeeNo: v.method === 'employee' ? v.employeeNo : undefined, joinCode: v.method === 'employee' ? v.joinCode : undefined, language: v.language });
        signInDemoUser(id);
        void navigate({ to: '/passenger' });
        return;
      }
      if (signedIn) return await attach(v);
      const { needsConfirmation } = await signUp({ email: v.email, password: v.password, fullName: v.fullName, language: v.language, redirectTo: '/register' });
      if (needsConfirmation) return setConfirmEmail(true);
      await attach(v);
    } catch (e) {
      setError(e);
    }
  });

  if (confirmEmail) {
    return (
      <div className="space-y-4 text-center" role="status">
        <MailCheck className="mx-auto size-10 text-brand-500" aria-hidden="true" />
        <h1 className="text-xl font-extrabold">{t('passenger.register.checkEmail')}</h1>
        <p className="text-sm text-fg-2">{t('passenger.register.checkEmailBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t('passenger.register.backToSignIn')}
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('passenger.register.title')}</h1>
        <p className="text-sm text-fg-2">{t('passenger.register.subtitle')}</p>
      </div>
      <form noValidate className="space-y-4" onSubmit={(e) => void submit(e)}>
        <Field id="reg-name" label={t('people.name')} error={errors.fullName?.message}>
          <Input id="reg-name" autoComplete="name" {...form.register('fullName')} />
        </Field>
        <Field id="reg-email" label={t('auth.email')} error={errors.email?.message}>
          <Input id="reg-email" type="email" dir="ltr" autoComplete="email" disabled={signedIn} {...form.register('email')} />
        </Field>
        {!signedIn && (
          <Field id="reg-password" label={t('auth.password')} error={errors.password?.message}>
            <Input id="reg-password" type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
        )}
        <Field id="reg-phone" label={t('people.phone')}>
          <Input id="reg-phone" type="tel" dir="ltr" autoComplete="tel" {...form.register('phone')} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('passenger.register.how')}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['email', 'employee'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => form.setValue('method', m)}
                className={cn('rounded-md border px-3 py-2 text-start text-sm', method === m ? 'border-brand-500 ring-1 ring-brand-500' : 'border-border')}
              >
                <span className="block font-semibold">{t(`passenger.register.method.${m}`)}</span>
                <span className="block text-xs text-fg-3">{t(`passenger.register.methodHint.${m}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {method === 'employee' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reg-employee" label={t('people.employeeNo')} error={errors.employeeNo?.message}>
              <Input id="reg-employee" dir="ltr" {...form.register('employeeNo')} />
            </Field>
            <Field id="reg-code" label={t('passenger.register.joinCode')} hint={t('passenger.register.joinCodeHint')} error={errors.joinCode?.message}>
              <Input id="reg-code" dir="ltr" className="uppercase" {...form.register('joinCode')} />
            </Field>
          </div>
        )}
        <Field id="reg-language" label={t('common.language')}>
          <NativeSelect id="reg-language" {...form.register('language')}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </NativeSelect>
        </Field>
        <FormError error={error} />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('common.loading') : t('passenger.register.submit')}
        </Button>
        <p className="text-center text-xs text-fg-3">{t('passenger.register.approvalNote')}</p>
      </form>
    </div>
  );
}
