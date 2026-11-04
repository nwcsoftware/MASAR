import type { DocumentTypeValues } from './schema';

/**
 * Starter catalogues by country (Settings → Documents). The company edits
 * them freely; adding a preset skips names it already has.
 */
type Preset = Omit<DocumentTypeValues, 'is_active' | 'is_driving_licence'>;

export const DOCUMENT_PRESETS: Record<'SA' | 'AE' | 'generic', Preset[]> = {
  SA: [
    { name: 'Passport', name_ar: 'جواز السفر', has_expiry: true, remind_days: 60 },
    { name: 'Resident ID (Iqama)', name_ar: 'هوية مقيم (الإقامة)', has_expiry: true, remind_days: 30 },
    { name: 'National ID', name_ar: 'الهوية الوطنية', has_expiry: true, remind_days: 30 },
    { name: 'Light vehicle driving licence', name_ar: 'رخصة قيادة خاصة', has_expiry: true, remind_days: 30 },
    { name: 'Heavy vehicle driving licence', name_ar: 'رخصة قيادة عمومي ثقيل', has_expiry: true, remind_days: 30 },
    { name: 'Driving authorisation', name_ar: 'تفويض قيادة', has_expiry: true, remind_days: 30 },
    { name: 'Medical insurance', name_ar: 'التأمين الطبي', has_expiry: true, remind_days: 30 },
    { name: 'Work permit', name_ar: 'رخصة العمل', has_expiry: true, remind_days: 30 },
  ],
  AE: [
    { name: 'Passport', name_ar: 'جواز السفر', has_expiry: true, remind_days: 60 },
    { name: 'Emirates ID', name_ar: 'الهوية الإماراتية', has_expiry: true, remind_days: 30 },
    { name: 'Residence visa', name_ar: 'تأشيرة الإقامة', has_expiry: true, remind_days: 30 },
    { name: 'UAE driving licence', name_ar: 'رخصة القيادة الإماراتية', has_expiry: true, remind_days: 30 },
    { name: 'Labour card', name_ar: 'بطاقة العمل', has_expiry: true, remind_days: 30 },
    { name: 'Health insurance', name_ar: 'التأمين الصحي', has_expiry: true, remind_days: 30 },
  ],
  generic: [
    { name: 'Passport', name_ar: 'جواز السفر', has_expiry: true, remind_days: 60 },
    { name: 'Identity card', name_ar: 'بطاقة الهوية', has_expiry: true, remind_days: 30 },
    { name: 'Driving licence', name_ar: 'رخصة القيادة', has_expiry: true, remind_days: 30 },
    { name: 'Driving authorisation', name_ar: 'تفويض قيادة', has_expiry: true, remind_days: 30 },
    { name: 'Insurance', name_ar: 'التأمين', has_expiry: true, remind_days: 30 },
  ],
};

export type PresetCountry = keyof typeof DOCUMENT_PRESETS;

export const isLicence = (name: string) => /licen[cs]e/i.test(name);

export function presetFor(countryCode: string | null | undefined): PresetCountry {
  return countryCode === 'SA' || countryCode === 'AE' ? countryCode : 'generic';
}
