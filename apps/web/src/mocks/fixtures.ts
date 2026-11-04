/**
 * Phase 0 mock data — the same company, people and day as supabase/seed.sql,
 * typed as real database rows so query hooks can swap mock → Supabase without
 * touching components. Times are relative to "today" in Asia/Riyadh (UTC+3,
 * no DST), so the board always looks live.
 */
import type { Tables } from '@/lib/database.types';

export type Company = Tables<'companies'>;
export type CompanySettings = Tables<'company_settings'>;
export type Profile = Tables<'profiles'>;
export type Site = Tables<'sites'>;
export type Airport = Tables<'airports'>;
export type SiteAirport = Tables<'site_airports'>;
export type Driver = Tables<'drivers'>;
export type Vehicle = Tables<'vehicles'>;
export type DriverAvailability = Tables<'driver_availability'>;
export type DriverLocation = Tables<'driver_locations'>;
export type Task = Tables<'tasks'>;
export type TaskStop = Tables<'task_stops'>;
export type TaskAssignment = Tables<'task_assignments'>;
export type FlightDetails = Tables<'flight_details'>;
export type TaskDelay = Tables<'task_delays'>;
export type TaskEvent = Tables<'task_events'>;
export type TaskConflict = Tables<'task_conflicts'>;
export type TaskAttachment = Tables<'task_attachments'>;
export type Notification = Tables<'notifications'>;
export type Holiday = Tables<'holidays'>;
export type DriverDaySummary = Tables<'driver_day_summary'>;
export type GradeGroup = Tables<'grade_groups'>;
export type Person = Tables<'people'>;
export type DocumentType = Tables<'document_types'>;
export type JobTitle = Tables<'job_titles'>;
export type JobTitleDocument = Tables<'job_title_documents'>;
export type DriverDocument = Tables<'driver_documents'>;
export type RatingOption = Tables<'rating_options'>;
export type TripRating = Tables<'trip_ratings'>;
export type TripRatingChoice = Tables<'trip_rating_choices'>;
export type EmergencyContact = Tables<'emergency_contacts'>;
export type TaskPassenger = Tables<'task_passengers'>;
export type TripShareLink = Tables<'trip_share_links'>;
export type SosEvent = Tables<'sos_events'>;
export type TripRequest = Tables<'trip_requests'>;

// ---------------------------------------------------------------------------
// time helpers
// ---------------------------------------------------------------------------
const RIYADH_OFFSET = '+03:00';

function riyadhToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = riyadhToday();
/** ISO timestamp for HH:MM on today + `day` in Riyadh. */
export const at = (day: number, hhmm: string) => new Date(`${addDays(TODAY, day)}T${hhmm}:00${RIYADH_OFFSET}`).toISOString();
export const dateKey = (day: number) => addDays(TODAY, day);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const CREATED = at(-30, '09:00');

// ---------------------------------------------------------------------------
// ids (same as seed.sql)
// ---------------------------------------------------------------------------
export const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const U = (n: string) => `10000000-0000-4000-8000-0000000000${n}`;
const S = (n: number) => `20000000-0000-4000-8000-00000000000${n}`;
const A = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;
const D = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
const V = (n: number) => `50000000-0000-4000-8000-00000000000${n}`;
const T = (n: number) => `60000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const G = (n: number) => `12000000-0000-4000-8000-00000000000${n}`;
const P = (n: number) => `13000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const DT = (n: number) => `14000000-0000-4000-8000-00000000000${n}`;
const JT = (n: number) => `15000000-0000-4000-8000-00000000000${n}`;

export const IDS = {
  users: { owner: U('01'), dispatcher: U('02'), dammam: U('03'), viewer: U('04'), ahmed: U('11'), khalid: U('12'), yousef: U('13'), fahad: U('14'), sara: U('21'), laila: U('22') },
  sites: { rhq: S(1), yasmin: S(2), dammam: S(3), jeddah: S(4) },
  airports: { ruh: A(1), dmm: A(2), jed: A(3) },
  drivers: { ahmed: D(1), khalid: D(2), yousef: D(3), fahad: D(4) },
  vehicles: { camry: V(1), hiace: V(2), h1: V(3), cruiser: V(4) },
  tasks: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, T(i + 1)])) as Record<number, string>,
  groups: { A: G(1), B: G(2), C: G(3), D: G(4) },
  people: { sara: P(1), hamad: P(2), tariq: P(3), faisal: P(4), karim: P(5), omar: P(6), saad: P(7), noura: P(8), bilal: P(9), maha: P(10), laila: P(11) },
  docTypes: { passport: DT(1), iqama: DT(2), lightLicence: DT(3), heavyLicence: DT(4), authorisation: DT(5), insurance: DT(6) },
  jobTitles: { light: JT(1), heavy: JT(2) },
} as const;

// ---------------------------------------------------------------------------
// tenancy
// ---------------------------------------------------------------------------
export const company: Company = {
  id: COMPANY_ID,
  name: 'Masar Demo Contracting',
  name_ar: 'مسار للمقاولات (تجريبي)',
  country_code: 'SA',
  timezone: 'Asia/Riyadh',
  default_language: 'en',
  logo_url: null,
  created_at: CREATED,
  updated_at: CREATED,
};

export const companySettings: CompanySettings = {
  company_id: COMPANY_ID,
  reminder_offsets_min: [1440, 120, 30],
  start_prompt_after_min: 5,
  complete_prompt_after_min: 10,
  ack_deadline_min: 120,
  grace_min: 15,
  no_show_after_min: 60,
  far_location_km: 50,
  airport_share_window_min: 90,
  standard_day_min: 480,
  weekly_max_min: 2880,
  max_daily_driving_min: 600,
  weekend_days: [5, 6],
  offline_alert_after_min: 10,
  location_interval_sec: 30,
  eastern_arabic_digits: false,
  flight_api_enabled: false,
  passenger_email_domains: ['masar.dev'],
  passenger_join_code: 'MASAR-2026',
  rating_edit_hours: 24,
  low_rating_threshold: 2,
  updated_at: CREATED,
};

function profile(p: Pick<Profile, 'id' | 'role' | 'full_name' | 'full_name_ar' | 'email' | 'phone' | 'language'>): Profile {
  return {
    company_id: COMPANY_ID,
    avatar_url: null,
    is_active: true,
    notif_in_app: true,
    notif_push: true,
    notif_email: false,
    created_at: CREATED,
    updated_at: CREATED,
    ...p,
  };
}

export const profiles: Profile[] = [
  profile({ id: IDS.users.owner, role: 'owner', full_name: 'Majed Al-Harbi', full_name_ar: 'ماجد الحربي', email: 'owner@masar.dev', phone: '+966 50 100 0001', language: 'en' }),
  profile({ id: IDS.users.dispatcher, role: 'dispatcher', full_name: 'Nawaf Al-Anazi', full_name_ar: 'نواف العنزي', email: 'dispatcher@masar.dev', phone: '+966 50 100 0002', language: 'en' }),
  profile({ id: IDS.users.dammam, role: 'dispatcher', full_name: 'Huda Al-Dossary', full_name_ar: 'هدى الدوسري', email: 'dammam@masar.dev', phone: '+966 50 100 0003', language: 'ar' }),
  profile({ id: IDS.users.viewer, role: 'viewer', full_name: 'Reem Al-Shehri', full_name_ar: 'ريم الشهري', email: 'viewer@masar.dev', phone: '+966 50 100 0004', language: 'en' }),
  profile({ id: IDS.users.ahmed, role: 'driver', full_name: 'Ahmed Saleh', full_name_ar: 'أحمد صالح', email: 'ahmed@masar.dev', phone: '+966 55 200 0011', language: 'ar' }),
  profile({ id: IDS.users.khalid, role: 'driver', full_name: 'Khalid Mansour', full_name_ar: 'خالد منصور', email: 'khalid@masar.dev', phone: '+966 55 200 0012', language: 'ar' }),
  profile({ id: IDS.users.yousef, role: 'driver', full_name: 'Yousef Rashid', full_name_ar: 'يوسف راشد', email: 'yousef@masar.dev', phone: '+966 55 200 0013', language: 'en' }),
  profile({ id: IDS.users.fahad, role: 'driver', full_name: 'Fahad Al-Qahtani', full_name_ar: 'فهد القحطاني', email: 'fahad@masar.dev', phone: '+966 55 200 0014', language: 'ar' }),
  // 0006 passengers: Sara approved, Laila waiting for approval
  profile({ id: IDS.users.sara, role: 'passenger', full_name: 'Eng. Sara Al-Otaibi', full_name_ar: 'م. سارة العتيبي', email: 'sara@masar.dev', phone: '+966 55 010 2030', language: 'en' }),
  profile({ id: IDS.users.laila, role: 'passenger', full_name: 'Eng. Laila Hassan', full_name_ar: 'م. ليلى حسن', email: 'laila@masar.dev', phone: '+966 55 000 1111', language: 'en' }),
];

// ---------------------------------------------------------------------------
// platform (0008): the super admin belongs to no company and creates them
// ---------------------------------------------------------------------------
export const SUPER_ADMIN_ID = U('99');
export const platformAdmins: Profile[] = [
  {
    ...profile({ id: SUPER_ADMIN_ID, role: 'viewer', full_name: 'Masar Platform', full_name_ar: 'منصة مسار', email: 'super@masar.dev', phone: null, language: 'en' }),
    company_id: null,
  },
];

/** Another tenant, only visible to the super admin (its data never reaches the demo company's screens). */
export interface PlatformCompanyMock {
  company: Company;
  owner: { full_name: string; email: string; pending: boolean } | null;
  site_count: number;
  user_count: number;
}
export const otherCompanies: PlatformCompanyMock[] = [
  {
    company: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Gulf Builders',
      name_ar: 'بناة الخليج',
      country_code: 'AE',
      timezone: 'Asia/Dubai',
      default_language: 'en',
      logo_url: null,
      created_at: CREATED,
      updated_at: CREATED,
    },
    owner: { full_name: 'Omar Haddad', email: 'omar@gulfbuilders.ae', pending: true },
    site_count: 0,
    user_count: 1,
  },
];

/** user_sites — empty list means "all sites" (auth_can_access_site). */
export const userSites: Record<string, string[]> = {
  [IDS.users.dispatcher]: [IDS.sites.rhq, IDS.sites.yasmin],
  [IDS.users.dammam]: [IDS.sites.dammam],
};

// ---------------------------------------------------------------------------
// sites & airports
// ---------------------------------------------------------------------------
function site(p: Pick<Site, 'id' | 'code' | 'name' | 'name_ar' | 'type' | 'address' | 'address_ar' | 'city' | 'lat' | 'lng' | 'contact_name' | 'contact_phone' | 'work_start' | 'work_end'>): Site {
  return { company_id: COMPANY_ID, google_place_id: null, notes: null, is_active: true, created_at: CREATED, updated_at: CREATED, ...p };
}

export const sites: Site[] = [
  site({ id: IDS.sites.rhq, code: 'RHQ', name: 'Riyadh HQ', name_ar: 'المقر الرئيسي – الرياض', type: 'office', address: 'Olaya St, Al Olaya, Riyadh', address_ar: 'شارع العليا، حي العليا، الرياض', city: 'Riyadh', lat: 24.6948, lng: 46.6857, contact_name: 'Nawaf Al-Anazi', contact_phone: '+966 50 100 0002', work_start: '07:30:00', work_end: '17:00:00' }),
  site({ id: IDS.sites.yasmin, code: 'YAS', name: 'Al Yasmin Site', name_ar: 'موقع الياسمين', type: 'construction_site', address: 'Al Yasmin District, Riyadh', address_ar: 'حي الياسمين، الرياض', city: 'Riyadh', lat: 24.8236, lng: 46.6407, contact_name: 'Eng. Omar Fawzi', contact_phone: '+966 50 300 0001', work_start: '06:30:00', work_end: '16:30:00' }),
  site({ id: IDS.sites.dammam, code: 'DMM', name: 'Dammam Site', name_ar: 'موقع الدمام', type: 'construction_site', address: 'King Saud St, Dammam', address_ar: 'شارع الملك سعود، الدمام', city: 'Dammam', lat: 26.4207, lng: 50.0888, contact_name: 'Huda Al-Dossary', contact_phone: '+966 50 100 0003', work_start: '06:30:00', work_end: '16:30:00' }),
  site({ id: IDS.sites.jeddah, code: 'JED', name: 'Jeddah Tower', name_ar: 'برج جدة', type: 'construction_site', address: 'North Obhur, Jeddah', address_ar: 'أبحر الشمالية، جدة', city: 'Jeddah', lat: 21.735, lng: 39.085, contact_name: 'Eng. Faisal Nasser', contact_phone: '+966 50 300 0002', work_start: '06:30:00', work_end: '16:30:00' }),
];

function airport(p: Pick<Airport, 'id' | 'iata' | 'icao' | 'name' | 'name_ar' | 'city' | 'city_ar' | 'lat' | 'lng' | 'terminals'>): Airport {
  return { company_id: COMPANY_ID, country_code: 'SA', google_place_id: null, is_international: true, source: 'manual', created_at: CREATED, ...p };
}

export const airports: Airport[] = [
  airport({ id: IDS.airports.ruh, iata: 'RUH', icao: 'OERK', name: 'King Khalid International Airport', name_ar: 'مطار الملك خالد الدولي', city: 'Riyadh', city_ar: 'الرياض', lat: 24.9576, lng: 46.6988, terminals: ['1', '2', '3', '4', '5'] }),
  airport({ id: IDS.airports.dmm, iata: 'DMM', icao: 'OEDF', name: 'King Fahd International Airport', name_ar: 'مطار الملك فهد الدولي', city: 'Dammam', city_ar: 'الدمام', lat: 26.4712, lng: 49.7979, terminals: [] }),
  airport({ id: IDS.airports.jed, iata: 'JED', icao: 'OEJN', name: 'King Abdulaziz International Airport', name_ar: 'مطار الملك عبدالعزيز الدولي', city: 'Jeddah', city_ar: 'جدة', lat: 21.6796, lng: 39.1565, terminals: ['1', 'North'] }),
];

export const siteAirports: SiteAirport[] = [
  { site_id: IDS.sites.rhq, airport_id: IDS.airports.ruh, is_active: true, is_default: true, distance_km: 39.6, drive_minutes: 34, default_buffer_min: 30, created_at: CREATED },
  { site_id: IDS.sites.yasmin, airport_id: IDS.airports.ruh, is_active: true, is_default: true, distance_km: 24.4, drive_minutes: 21, default_buffer_min: 30, created_at: CREATED },
  { site_id: IDS.sites.dammam, airport_id: IDS.airports.dmm, is_active: true, is_default: true, distance_km: 39.8, drive_minutes: 34, default_buffer_min: 30, created_at: CREATED },
  { site_id: IDS.sites.jeddah, airport_id: IDS.airports.jed, is_active: true, is_default: true, distance_km: 12.6, drive_minutes: 15, default_buffer_min: 30, created_at: CREATED },
];

// ---------------------------------------------------------------------------
// grades (0004): this company counts 20 as most senior
// ---------------------------------------------------------------------------
function group(n: number, code: string, name: string, name_ar: string, min_grade: number, max_grade: number): GradeGroup {
  return { id: G(n), company_id: COMPANY_ID, code, name, name_ar, rank: n, min_grade, max_grade, created_at: CREATED };
}

export const gradeGroups: GradeGroup[] = [
  group(1, 'A', 'Executives', 'الإدارة العليا', 16, 20),
  group(2, 'B', 'Managers', 'المدراء', 11, 15),
  group(3, 'C', 'Staff', 'الموظفون', 6, 10),
  group(4, 'D', 'Support', 'الدعم', 1, 5),
];

function person(n: number, employee_no: string, full_name: string, full_name_ar: string, grade: number, job_title: string, department: string, site_id: string, phone: string): Person {
  return {
    id: P(n),
    company_id: COMPANY_ID,
    employee_no,
    full_name,
    full_name_ar,
    grade,
    job_title,
    department,
    site_id,
    phone,
    email: null,
    is_active: true,
    notes: null,
    source: 'import',
    profile_id: null,
    registration_status: null,
    registration_note: null,
    photo_url: null,
    language: 'en',
    accessibility_needs: null,
    ride_preferences: [],
    created_by: null,
    created_at: CREATED,
    updated_at: CREATED,
  };
}

/** Staff directory (same as seed.sql). */
export const people: Person[] = [
  person(1, 'E-1001', 'Eng. Sara Al-Otaibi', 'م. سارة العتيبي', 14, 'Project Engineer', 'Engineering', IDS.sites.yasmin, '+966 55 010 2030'),
  person(2, 'E-1002', 'Mr. Hamad Al-Mutairi', 'أ. حمد المطيري', 13, 'Procurement Manager', 'Procurement', IDS.sites.rhq, '+966 50 400 1122'),
  person(3, 'E-1003', 'Mr. Tariq Hassan', 'أ. طارق حسن', 17, 'Chief Accountant', 'Finance', IDS.sites.jeddah, '+966 50 400 3344'),
  person(4, 'E-1004', 'Eng. Faisal Nasser', 'م. فيصل ناصر', 15, 'Project Manager', 'Engineering', IDS.sites.jeddah, '+966 50 300 0002'),
  person(5, 'E-1005', 'Eng. Karim Haddad', 'م. كريم حداد', 12, 'Site Engineer', 'Engineering', IDS.sites.yasmin, '+974 55 111 2233'),
  person(6, 'E-1006', 'Eng. Omar Fawzi', 'م. عمر فوزي', 13, 'Site Manager', 'Engineering', IDS.sites.yasmin, '+966 50 300 0001'),
  person(7, 'E-1007', 'Mr. Saad Al-Ghamdi', 'أ. سعد الغامدي', 19, 'Finance Director', 'Finance', IDS.sites.rhq, '+966 50 400 5566'),
  person(8, 'E-1008', 'Ms. Noura Al-Harthi', 'أ. نورة الحارثي', 7, 'Accountant', 'Finance', IDS.sites.rhq, '+966 50 400 7788'),
  person(9, 'E-1009', 'Mr. Bilal Ahmed', 'أ. بلال أحمد', 4, 'Office Assistant', 'Admin', IDS.sites.rhq, '+966 50 400 9900'),
  person(10, 'E-1010', 'Ms. Maha Al-Dosari', 'أ. مها الدوسري', 16, 'HR Director', 'HR', IDS.sites.rhq, '+966 50 400 1010'),
  // 0006: Laila signed up herself and waits for approval
  { ...person(11, 'E-1011', 'Eng. Laila Hassan', 'م. ليلى حسن', 14, 'Project Engineer', 'Engineering', IDS.sites.rhq, '+966 55 000 1111'), source: 'self', email: 'laila@masar.dev', profile_id: U('22'), registration_status: 'pending' },
].map((p) => (p.id === P(1) ? { ...p, profile_id: U('21'), registration_status: 'approved', ride_preferences: ['ac', 'quiet'] } : p));

export const emergencyContacts: EmergencyContact[] = [
  { id: 'e1000000-0000-4000-8000-000000000001', person_id: P(1), name: 'Faisal Al-Otaibi', relation: 'Brother', phone: '+966 55 999 1234', created_at: CREATED },
];

/** 0007: Sara asks for a ride tomorrow morning (pending, for the Requests inbox). */
export const tripRequests: TripRequest[] = [
  {
    id: 'b7000000-0000-4000-8000-000000000001',
    company_id: COMPANY_ID,
    person_id: P(1),
    requested_by: U('21'),
    kind: 'new',
    task_id: null,
    site_id: IDS.sites.yasmin,
    requested_start: at(1, '07:30'),
    pickup: 'Riyadh HQ',
    dropoff: 'Al Yasmin Site',
    passengers_count: 1,
    notes: 'Site inspection with the consultant',
    status: 'pending',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_task_id: null,
    created_at: minutesAgo(45),
    updated_at: minutesAgo(45),
  },
];

/** A passenger as fn_snapshot_passengers stores it (grade + group stamped). */
function staff(id: string) {
  const p = people.find((x) => x.id === id)!;
  const g = gradeGroups.find((x) => p.grade != null && p.grade >= x.min_grade && p.grade <= x.max_grade)!;
  return { person_id: p.id, name: p.full_name, phone: p.phone, grade: p.grade, group_id: g.id, group_code: g.code };
}
function visitor(name: string, phone: string, code: 'A' | 'B' | 'C' | 'D') {
  return { name, phone, visitor: true, group_id: IDS.groups[code], group_code: code };
}

// ---------------------------------------------------------------------------
// drivers & vehicles
// ---------------------------------------------------------------------------
function driver(p: Pick<Driver, 'id' | 'profile_id' | 'home_site_id' | 'employee_no' | 'full_name' | 'full_name_ar' | 'phone' | 'licence_no' | 'licence_expiry' | 'max_daily_driving_min' | 'shift_start' | 'shift_end' | 'current_status' | 'last_seen_at' | 'grade' | 'serve_group_id'>): Driver {
  // 0005: Yousef drives the heavy vehicles, everyone else light duty
  const job_title_id = p.id === IDS.drivers.yousef ? IDS.jobTitles.heavy : IDS.jobTitles.light;
  // 0006: shown on the passenger's driver card
  const card: Record<string, [string, number]> = {
    [IDS.drivers.ahmed]: ['Saudi', 4],
    [IDS.drivers.khalid]: ['Egyptian', 3],
    [IDS.drivers.yousef]: ['Pakistani', 5],
    [IDS.drivers.fahad]: ['Saudi', 4],
  };
  const [nationality, english_rating] = card[p.id] ?? [null, null];
  return { company_id: COMPANY_ID, photo_url: null, is_active: true, notes: null, created_at: CREATED, updated_at: CREATED, job_title_id, nationality, english_rating, ...p };
}

export const drivers: Driver[] = [
  driver({ id: IDS.drivers.ahmed, profile_id: IDS.users.ahmed, home_site_id: IDS.sites.rhq, employee_no: 'D-001', full_name: 'Ahmed Saleh', full_name_ar: 'أحمد صالح', phone: '+966 55 200 0011', licence_no: 'SA-1029384', licence_expiry: dateKey(400), max_daily_driving_min: null, shift_start: '07:00:00', shift_end: '17:00:00', current_status: 'delayed', last_seen_at: minutesAgo(0.5), grade: 8, serve_group_id: IDS.groups.A }),
  driver({ id: IDS.drivers.khalid, profile_id: IDS.users.khalid, home_site_id: IDS.sites.dammam, employee_no: 'D-002', full_name: 'Khalid Mansour', full_name_ar: 'خالد منصور', phone: '+966 55 200 0012', licence_no: 'SA-5647382', licence_expiry: dateKey(45), max_daily_driving_min: null, shift_start: '07:00:00', shift_end: '17:00:00', current_status: 'idle', last_seen_at: minutesAgo(2), grade: 5, serve_group_id: IDS.groups.C }),
  driver({ id: IDS.drivers.yousef, profile_id: IDS.users.yousef, home_site_id: IDS.sites.jeddah, employee_no: 'D-003', full_name: 'Yousef Rashid', full_name_ar: 'يوسف راشد', phone: '+966 55 200 0013', licence_no: 'SA-8899001', licence_expiry: dateKey(800), max_daily_driving_min: 300, shift_start: '07:00:00', shift_end: '17:00:00', current_status: 'in_progress', last_seen_at: minutesAgo(1), grade: 7, serve_group_id: IDS.groups.A }),
  driver({ id: IDS.drivers.fahad, profile_id: IDS.users.fahad, home_site_id: IDS.sites.rhq, employee_no: 'D-004', full_name: 'Fahad Al-Qahtani', full_name_ar: 'فهد القحطاني', phone: '+966 55 200 0014', licence_no: 'SA-1122334', licence_expiry: dateKey(220), max_daily_driving_min: null, shift_start: '06:00:00', shift_end: '15:00:00', current_status: 'idle', last_seen_at: minutesAgo(14), grade: 6, serve_group_id: IDS.groups.B }),
];

function vehicle(p: Pick<Vehicle, 'id' | 'site_id' | 'plate_no' | 'make' | 'model' | 'year' | 'color' | 'seats' | 'odometer_km' | 'grade_group_id'>): Vehicle {
  return { company_id: COMPANY_ID, is_active: true, notes: null, created_at: CREATED, updated_at: CREATED, ...p };
}

export const vehicles: Vehicle[] = [
  vehicle({ id: IDS.vehicles.camry, site_id: IDS.sites.rhq, plate_no: '1234 RAB', make: 'Toyota', model: 'Camry', year: 2024, color: 'White', seats: 4, odometer_km: 38200, grade_group_id: IDS.groups.B }),
  vehicle({ id: IDS.vehicles.hiace, site_id: IDS.sites.rhq, plate_no: '5678 KSA', make: 'Toyota', model: 'Hiace', year: 2023, color: 'White', seats: 12, odometer_km: 71475, grade_group_id: IDS.groups.C }),
  vehicle({ id: IDS.vehicles.h1, site_id: IDS.sites.dammam, plate_no: '4321 DMM', make: 'Hyundai', model: 'H1', year: 2022, color: 'Silver', seats: 8, odometer_km: 102300, grade_group_id: IDS.groups.C }),
  vehicle({ id: IDS.vehicles.cruiser, site_id: IDS.sites.jeddah, plate_no: '8765 JED', make: 'Toyota', model: 'Land Cruiser', year: 2024, color: 'Black', seats: 7, odometer_km: 15800, grade_group_id: IDS.groups.A }),
];

export const driverAvailability: DriverAvailability[] = [
  { id: 'a0000000-0000-4000-8000-000000000001', driver_id: IDS.drivers.fahad, type: 'leave', starts_at: at(7, '00:00'), ends_at: at(10, '00:00'), note: 'Annual leave', created_by: IDS.users.owner, created_at: CREATED },
];

let locationSeq = 1;
function location(driverId: string, lat: number, lng: number, minsAgo: number, taskId: string | null, speed: number, battery: number): DriverLocation {
  return { id: locationSeq++, driver_id: driverId, company_id: COMPANY_ID, task_id: taskId, lat, lng, accuracy_m: 8, speed_kmh: speed, heading: 90, battery_pct: battery, recorded_at: minutesAgo(minsAgo) };
}

/** Latest ping per driver (v_driver_latest_location). */
export const driverLocations: DriverLocation[] = [
  location(IDS.drivers.ahmed, 24.955, 46.699, 0.5, T(2), 0, 76),
  location(IDS.drivers.khalid, 26.425, 50.09, 2, null, 0, 54),
  location(IDS.drivers.yousef, 21.5497, 39.1622, 1, T(6), 0, 63),
  location(IDS.drivers.fahad, 24.695, 46.686, 14, null, 0, 91),
];

// ---------------------------------------------------------------------------
// documents (0005) — same as seed.sql: Ahmed's resident ID is due in 20 days,
// Khalid's authorisation lapsed 5 days ago and his insurance is missing,
// Yousef's passport is inside its 60-day window, Fahad is in order.
// ---------------------------------------------------------------------------
function docType(n: number, name: string, name_ar: string, remind_days: number): DocumentType {
  return { id: DT(n), company_id: COMPANY_ID, name, name_ar, description: null, has_expiry: true, is_driving_licence: /licen/i.test(name), remind_days, is_active: true, created_at: CREATED };
}

export const documentTypes: DocumentType[] = [
  docType(1, 'Passport', 'جواز السفر', 60),
  docType(2, 'Resident ID (Iqama)', 'هوية مقيم (الإقامة)', 30),
  docType(3, 'Light vehicle driving licence', 'رخصة قيادة خاصة', 30),
  docType(4, 'Heavy vehicle driving licence', 'رخصة قيادة عمومي ثقيل', 30),
  docType(5, 'Driving authorisation', 'تفويض قيادة', 30),
  docType(6, 'Medical insurance', 'التأمين الطبي', 30),
];

export const jobTitles: JobTitle[] = [
  { id: JT(1), company_id: COMPANY_ID, name: 'Light duty driver', name_ar: 'سائق خفيف', description: 'Sedans, SUVs and vans up to 3.5 t', is_active: true, created_at: CREATED },
  { id: JT(2), company_id: COMPANY_ID, name: 'Heavy duty driver', name_ar: 'سائق ثقيل', description: 'Buses and trucks over 3.5 t', is_active: true, created_at: CREATED },
];

export const jobTitleDocuments: JobTitleDocument[] = [
  ...[1, 2, 3, 5, 6].map((n) => ({ job_title_id: JT(1), document_type_id: DT(n) })),
  ...[1, 2, 4, 5, 6].map((n) => ({ job_title_id: JT(2), document_type_id: DT(n) })),
];

let documentSeq = 0;
function doc(driverId: string, type: number, document_no: string, issuedDays: number, expiresDays: number, withCopy = true): DriverDocument {
  const id = `16000000-0000-4000-8000-${String(++documentSeq).padStart(12, '0')}`;
  return {
    id,
    company_id: COMPANY_ID,
    driver_id: driverId,
    document_type_id: DT(type),
    document_no,
    issued_on: dateKey(issuedDays),
    expires_on: dateKey(expiresDays),
    // demo/… copies render as a generated placeholder (features/documents/files.ts)
    storage_path: withCopy ? `demo/${driverId}/${document_no}.svg` : null,
    file_name: withCopy ? `${document_no}.pdf` : null,
    file_type: withCopy ? 'application/pdf' : null,
    file_size: withCopy ? 184_000 : null,
    notes: null,
    uploaded_by: withCopy ? IDS.users.owner : null,
    created_at: CREATED,
    updated_at: CREATED,
  };
}

export const driverDocuments: DriverDocument[] = [
  doc(IDS.drivers.ahmed, 1, 'P1029384', -900, 925),
  doc(IDS.drivers.ahmed, 2, '2412345678', -345, 20),
  doc(IDS.drivers.ahmed, 3, 'SA-1029384', -1425, 400),
  doc(IDS.drivers.ahmed, 5, 'AUTH-0011', -200, 165),
  doc(IDS.drivers.ahmed, 6, 'BUPA-77812', -100, 265),
  doc(IDS.drivers.khalid, 1, 'P5647382', -1500, 325),
  doc(IDS.drivers.khalid, 2, '2498765432', -300, 65),
  doc(IDS.drivers.khalid, 3, 'SA-5647382', -1800, 25, false),
  doc(IDS.drivers.khalid, 5, 'AUTH-0012', -370, -5),
  doc(IDS.drivers.yousef, 1, 'P8899001', -3600, 50),
  doc(IDS.drivers.yousef, 2, '2455566677', -100, 265),
  doc(IDS.drivers.yousef, 4, 'SA-8899001', -1000, 800),
  doc(IDS.drivers.yousef, 5, 'AUTH-0013', -60, 305),
  doc(IDS.drivers.yousef, 6, 'BUPA-77813', -30, 335),
  doc(IDS.drivers.fahad, 1, 'P1122334', -700, 1125),
  doc(IDS.drivers.fahad, 2, '2433344455', -150, 215),
  doc(IDS.drivers.fahad, 3, 'SA-1122334', -1300, 220),
  doc(IDS.drivers.fahad, 5, 'AUTH-0014', -90, 275),
  doc(IDS.drivers.fahad, 6, 'BUPA-77814', -60, 305),
];

// ---------------------------------------------------------------------------
// tasks (today = 1–10, tomorrow = 11–14)
// ---------------------------------------------------------------------------
type TaskSeed = Pick<Task, 'id' | 'site_id' | 'category' | 'status' | 'priority' | 'title' | 'description' | 'scheduled_start' | 'scheduled_end' | 'estimated_duration_min' | 'estimated_distance_km' | 'passengers'> &
  Partial<Pick<Task, 'actual_start_at' | 'actual_end_at' | 'actual_distance_km' | 'recurrence_rule_id' | 'recurrence_date' | 'completion_notes' | 'odometer_start_km' | 'odometer_end_km'>>;

function task(p: TaskSeed): Task {
  return {
    company_id: COMPANY_ID,
    actual_start_at: null,
    actual_end_at: null,
    actual_distance_km: null,
    odometer_start_km: null,
    odometer_end_km: null,
    requested_by: null,
    created_by: IDS.users.dispatcher,
    recurrence_rule_id: null,
    recurrence_date: null,
    remind_offsets_min: null,
    cancel_reason: null,
    completion_notes: null,
    conflicts_overridden: false,
    override_reason: null,
    override_by: null,
    metadata: {},
    created_at: CREATED,
    updated_at: CREATED,
    ...p,
  };
}

const ROUTINE_RULE = '70000000-0000-4000-8000-000000000001';

export const tasks: Task[] = [
  task({ id: T(1), site_id: IDS.sites.rhq, category: 'daily_routine', status: 'completed', priority: 'normal', title: 'Office shuttle', description: 'Morning staff shuttle HQ → Al Yasmin', scheduled_start: at(0, '08:00'), scheduled_end: at(0, '10:00'), estimated_duration_min: 120, estimated_distance_km: 24.5, passengers: [], actual_start_at: at(0, '08:02'), actual_end_at: at(0, '09:58'), actual_distance_km: 25, odometer_start_km: 71450, odometer_end_km: 71475, recurrence_rule_id: ROUTINE_RULE, recurrence_date: dateKey(0) }),
  task({ id: T(2), site_id: IDS.sites.rhq, category: 'airport', status: 'delayed', priority: 'high', title: 'Pick up Eng. Sara Al-Otaibi', description: 'Arrival from Jeddah, take to Al Yasmin Site office', scheduled_start: at(0, '12:45'), scheduled_end: at(0, '16:10'), estimated_duration_min: 205, estimated_distance_km: 61, passengers: [staff(IDS.people.sara)], actual_start_at: at(0, '12:47') }),
  task({ id: T(3), site_id: IDS.sites.rhq, category: 'escort', status: 'acknowledged', priority: 'normal', title: 'Escort Mr. Hamad to SAB Bank', description: 'Wait and return', scheduled_start: at(0, '17:00'), scheduled_end: at(0, '18:00'), estimated_duration_min: 60, estimated_distance_km: 9, passengers: [staff(IDS.people.hamad)] }),
  task({ id: T(4), site_id: IDS.sites.dammam, category: 'document_delivery', status: 'completed', priority: 'normal', title: 'Documents to Ministry of Labor', description: 'Contract renewals — get stamped receipt', scheduled_start: at(0, '09:00'), scheduled_end: at(0, '10:30'), estimated_duration_min: 90, estimated_distance_km: 14, passengers: [], actual_start_at: at(0, '09:05'), actual_end_at: at(0, '10:20'), actual_distance_km: 14.6, completion_notes: 'Receipt photographed' }),
  task({ id: T(5), site_id: IDS.sites.dammam, category: 'airport', status: 'assigned', priority: 'normal', title: 'DMM arrival · MS 691', description: 'Pick up visiting engineers from Cairo', scheduled_start: at(0, '14:20'), scheduled_end: at(0, '17:00'), estimated_duration_min: 160, estimated_distance_km: 72, passengers: [visitor('Eng. Mostafa Adel', '+20 100 555 0101', 'C'), visitor('Eng. Rania Samir', '+20 100 555 0102', 'C')] }),
  task({ id: T(6), site_id: IDS.sites.jeddah, category: 'escort', status: 'in_progress', priority: 'normal', title: 'Escort · Al Rajhi Bank', description: 'Accompany site accountant', scheduled_start: at(0, '10:30'), scheduled_end: at(0, '13:00'), estimated_duration_min: 150, estimated_distance_km: 22, passengers: [staff(IDS.people.tariq)], actual_start_at: at(0, '10:32') }),
  task({ id: T(7), site_id: IDS.sites.jeddah, category: 'airport', status: 'assigned', priority: 'high', title: 'JED departure · XY 210', description: 'Drop project manager for Riyadh flight', scheduled_start: at(0, '12:30'), scheduled_end: at(0, '15:40'), estimated_duration_min: 190, estimated_distance_km: 38, passengers: [staff(IDS.people.faisal)] }),
  task({ id: T(8), site_id: IDS.sites.rhq, category: 'daily_routine', status: 'completed', priority: 'normal', title: 'Site rounds', description: 'Pick up daily reports from Al Yasmin', scheduled_start: at(0, '08:00'), scheduled_end: at(0, '10:00'), estimated_duration_min: 120, estimated_distance_km: 26, passengers: [], actual_start_at: at(0, '07:58'), actual_end_at: at(0, '10:05'), actual_distance_km: 26.4 }),
  task({ id: T(9), site_id: IDS.sites.rhq, category: 'document_delivery', status: 'acknowledged', priority: 'normal', title: 'Documents to Chamber of Commerce', description: 'Certificate of origin', scheduled_start: at(0, '16:00'), scheduled_end: at(0, '17:00'), estimated_duration_min: 60, estimated_distance_km: 11, passengers: [] }),
  task({ id: T(10), site_id: IDS.sites.yasmin, category: 'airport', status: 'scheduled', priority: 'normal', title: 'Pick up consultant — EK 817', description: 'Arrival from Dubai', scheduled_start: at(0, '13:30'), scheduled_end: at(0, '15:45'), estimated_duration_min: 135, estimated_distance_km: 48, passengers: [visitor('Mr. David Lee', '+971 50 123 4567', 'B')] }),
  task({ id: T(11), site_id: IDS.sites.yasmin, category: 'airport', status: 'scheduled', priority: 'normal', title: 'RUH arrival · QR 1146', description: 'Pick up new site engineer', scheduled_start: at(1, '05:10'), scheduled_end: at(1, '07:30'), estimated_duration_min: 140, estimated_distance_km: 48, passengers: [staff(IDS.people.karim)] }),
  task({ id: T(12), site_id: IDS.sites.rhq, category: 'escort', status: 'scheduled', priority: 'normal', title: 'Escort finance team to Riyad Bank', description: null, scheduled_start: at(1, '10:00'), scheduled_end: at(1, '11:30'), estimated_duration_min: 90, estimated_distance_km: 12, passengers: [staff(IDS.people.saad), staff(IDS.people.noura)] }),
  task({ id: T(13), site_id: IDS.sites.rhq, category: 'daily_routine', status: 'assigned', priority: 'normal', title: 'Office shuttle', description: 'Morning staff shuttle HQ → Al Yasmin', scheduled_start: at(1, '08:00'), scheduled_end: at(1, '10:00'), estimated_duration_min: 120, estimated_distance_km: 24.5, passengers: [], recurrence_rule_id: ROUTINE_RULE, recurrence_date: dateKey(1) }),
  task({ id: T(14), site_id: IDS.sites.dammam, category: 'document_delivery', status: 'scheduled', priority: 'low', title: 'Permits to Dammam Municipality', description: null, scheduled_start: at(1, '09:30'), scheduled_end: at(1, '11:00'), estimated_duration_min: 90, estimated_distance_km: 9, passengers: [] }),
  // 0006 passenger trips (same as seed.sql): Sara's ride to rate, her Jeddah trip, Hamad's rated ride
  task({ id: T(15), site_id: IDS.sites.yasmin, category: 'escort', status: 'completed', priority: 'normal', title: 'Sara back to Riyadh HQ', description: 'Return after the site inspection', scheduled_start: at(-1, '16:00'), scheduled_end: at(-1, '16:45'), estimated_duration_min: 45, estimated_distance_km: 18, passengers: [staff(IDS.people.sara)], actual_start_at: at(-1, '16:03'), actual_end_at: at(-1, '16:43'), actual_distance_km: 18.4 }),
  task({ id: T(16), site_id: IDS.sites.yasmin, category: 'airport', status: 'acknowledged', priority: 'normal', title: 'RUH departure · SV 1043', description: 'Sara flies to Jeddah for the Tower handover', scheduled_start: at(3, '06:30'), scheduled_end: at(3, '07:40'), estimated_duration_min: 70, estimated_distance_km: 24, passengers: [staff(IDS.people.sara)] }),
  task({ id: T(17), site_id: IDS.sites.rhq, category: 'escort', status: 'completed', priority: 'normal', title: 'Escort Mr. Hamad to the Chamber', description: null, scheduled_start: at(-2, '10:00'), scheduled_end: at(-2, '11:00'), estimated_duration_min: 60, estimated_distance_km: 11, passengers: [staff(IDS.people.hamad)], actual_start_at: at(-2, '10:03'), actual_end_at: at(-2, '10:58'), actual_distance_km: 11.2 }),
];

let stopSeq = 0;
function stops(taskId: string, day: number, list: [string, string, number, number, string | null, string | null, string, number, number | null, number | null][]): TaskStop[] {
  return list.map(([label, address, lat, lng, siteId, airportId, hhmm, dwell, km, mins], i) => ({
    id: `80000000-0000-4000-8000-${String(++stopSeq).padStart(12, '0')}`,
    task_id: taskId,
    seq: i + 1,
    label,
    address,
    lat,
    lng,
    google_place_id: null,
    site_id: siteId,
    airport_id: airportId,
    planned_arrival_at: at(day, hhmm),
    dwell_min: dwell,
    leg_distance_km: km,
    leg_duration_min: mins,
    actual_arrival_at: null,
    actual_departure_at: null,
    contact_name: null,
    contact_phone: null,
    notes: null,
  }));
}

const RHQ: [string, string, number, number, string, null] = ['Riyadh HQ', 'Olaya St', 24.6948, 46.6857, IDS.sites.rhq, null];
const YAS: [string, string, number, number, string, null] = ['Al Yasmin Site', 'Al Yasmin', 24.8236, 46.6407, IDS.sites.yasmin, null];
const DMS: [string, string, number, number, string, null] = ['Dammam Site', 'King Saud St', 26.4207, 50.0888, IDS.sites.dammam, null];
const JTW: [string, string, number, number, string, null] = ['Jeddah Tower', 'North Obhur', 21.735, 39.085, IDS.sites.jeddah, null];

export const taskStops: TaskStop[] = [
  ...stops(T(1), 0, [[...RHQ, '08:00', 10, null, null], [...YAS, '08:40', 20, 24.5, 30]]),
  ...stops(T(2), 0, [[...RHQ, '12:45', 0, null, null], ['RUH Terminal 1 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, IDS.airports.ruh, '13:30', 40, 36, 45], ['Al Yasmin Site office', 'Al Yasmin', 24.8236, 46.6407, IDS.sites.yasmin, null, '15:40', 0, 25, 30]]),
  ...stops(T(3), 0, [[...RHQ, '17:00', 0, null, null], ['SAB Bank — Olaya', 'Olaya St, Riyadh', 24.711, 46.6745, null, null, '17:15', 30, 4.5, 15]]),
  ...stops(T(4), 0, [[...DMS, '09:00', 0, null, null], ['Ministry of Labor', 'Dammam', 26.4334, 50.1036, null, null, '09:25', 30, 7, 25]]),
  ...stops(T(5), 0, [[...DMS, '14:20', 0, null, null], ['DMM · Arrivals', 'King Fahd Intl', 26.4712, 49.7979, null, IDS.airports.dmm, '15:00', 45, 36, 40], [...DMS, '16:25', 0, 36, 40]]),
  ...stops(T(6), 0, [[...JTW, '10:30', 0, null, null], ['Al Rajhi Bank — Tahlia', 'Tahlia St, Jeddah', 21.5497, 39.1622, null, null, '11:05', 90, 22, 35]]),
  ...stops(T(7), 0, [[...JTW, '12:30', 0, null, null], ['JED North Terminal', 'King Abdulaziz Intl', 21.6796, 39.1565, null, IDS.airports.jed, '13:10', 20, 19, 40]]),
  ...stops(T(8), 0, [[...RHQ, '08:00', 0, null, null], [...YAS, '08:40', 30, 26, 40]]),
  ...stops(T(9), 0, [[...RHQ, '16:00', 0, null, null], ['Chamber of Commerce', 'King Fahd Rd, Riyadh', 24.727, 46.667, null, null, '16:20', 20, 5.5, 20]]),
  ...stops(T(10), 0, [[...YAS, '13:30', 0, null, null], ['RUH Terminal 2 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, IDS.airports.ruh, '14:05', 45, 24, 35]]),
  ...stops(T(11), 1, [[...YAS, '05:10', 0, null, null], ['RUH Terminal 1 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, IDS.airports.ruh, '05:45', 45, 24, 35]]),
  ...stops(T(12), 1, [[...RHQ, '10:00', 0, null, null], ['Riyad Bank — King Fahd Rd', 'King Fahd Rd', 24.7136, 46.6753, null, null, '10:15', 45, 6, 15]]),
  ...stops(T(13), 1, [[...RHQ, '08:00', 10, null, null], [...YAS, '08:40', 20, 24.5, 30]]),
  ...stops(T(14), 1, [[...DMS, '09:30', 0, null, null], ['Dammam Municipality', 'Dammam', 26.4392, 50.1033, null, null, '09:50', 30, 4.5, 20]]),
  ...stops(T(15), -1, [[...YAS, '16:00', 0, null, null], [...RHQ, '16:30', 15, 18, 30]]),
  ...stops(T(16), 3, [[...YAS, '06:30', 0, null, null], ['RUH Terminal 5 · Departures', 'King Khalid Intl', 24.9576, 46.6988, null, IDS.airports.ruh, '07:00', 10, 24, 30]]),
  ...stops(T(17), -2, [[...RHQ, '10:00', 0, null, null], ['Chamber of Commerce', 'King Fahd Rd, Riyadh', 24.727, 46.667, null, null, '10:20', 30, 5.5, 20]]),
];

function assignment(n: number, taskId: string, driverId: string, vehicleId: string | null, assignedBy: string, ack: string | null, eta: string | null = null): TaskAssignment {
  return {
    id: `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    task_id: taskId,
    driver_id: driverId,
    vehicle_id: vehicleId,
    is_primary: true,
    assigned_by: assignedBy,
    assigned_at: at(-1, '15:00'),
    acknowledged_at: ack,
    declined_at: null,
    decline_reason: null,
    eta_next_stop_at: eta,
    eta_updated_at: eta ? minutesAgo(3) : null,
  };
}

export const taskAssignments: TaskAssignment[] = [
  assignment(1, T(1), IDS.drivers.ahmed, IDS.vehicles.hiace, IDS.users.dispatcher, at(-1, '18:10')),
  assignment(2, T(2), IDS.drivers.ahmed, IDS.vehicles.camry, IDS.users.dispatcher, at(-1, '18:11'), at(0, '15:40')),
  assignment(3, T(3), IDS.drivers.ahmed, IDS.vehicles.camry, IDS.users.dispatcher, at(0, '07:05')),
  assignment(4, T(4), IDS.drivers.khalid, IDS.vehicles.h1, IDS.users.dammam, at(-1, '19:00')),
  assignment(5, T(5), IDS.drivers.khalid, IDS.vehicles.h1, IDS.users.dammam, null),
  assignment(6, T(6), IDS.drivers.yousef, IDS.vehicles.cruiser, IDS.users.owner, at(0, '06:50')),
  assignment(7, T(7), IDS.drivers.yousef, null, IDS.users.owner, null),
  assignment(8, T(8), IDS.drivers.fahad, IDS.vehicles.camry, IDS.users.dispatcher, at(-1, '17:30')),
  assignment(9, T(9), IDS.drivers.fahad, null, IDS.users.dispatcher, at(0, '11:20')),
  assignment(13, T(13), IDS.drivers.ahmed, IDS.vehicles.hiace, IDS.users.dispatcher, null),
  assignment(15, T(15), IDS.drivers.ahmed, IDS.vehicles.camry, IDS.users.dispatcher, at(-1, '12:00')),
  assignment(16, T(16), IDS.drivers.ahmed, IDS.vehicles.camry, IDS.users.dispatcher, at(0, '08:00')),
  assignment(17, T(17), IDS.drivers.fahad, IDS.vehicles.camry, IDS.users.dispatcher, at(-3, '18:00')),
];

function flight(taskId: string, airportId: string, direction: FlightDetails['direction'], airline: string, flightNo: string, terminal: string | null, scheduled: string, buffer: number, estimated: string | null = null, status = 'scheduled'): FlightDetails {
  return { task_id: taskId, airport_id: airportId, direction, airline, flight_no: flightNo, terminal, scheduled_time: scheduled, estimated_time: estimated, actual_time: null, buffer_min: buffer, flight_status: status, provider_payload: null, updated_at: CREATED };
}

export const flightDetails: FlightDetails[] = [
  flight(T(2), IDS.airports.ruh, 'arrival', 'Saudia', 'SV 1234', '1', at(0, '14:00'), 30, at(0, '14:40'), 'delayed'),
  flight(T(5), IDS.airports.dmm, 'arrival', 'EgyptAir', 'MS 691', null, at(0, '15:00'), 10),
  flight(T(7), IDS.airports.jed, 'departure', 'flynas', 'XY 210', 'North', at(0, '15:40'), 90),
  flight(T(10), IDS.airports.ruh, 'arrival', 'Emirates', 'EK 817', '2', at(0, '14:30'), 30),
  flight(T(11), IDS.airports.ruh, 'arrival', 'Qatar Airways', 'QR 1146', '1', at(1, '06:10'), 30),
  flight(T(16), IDS.airports.ruh, 'departure', 'Saudia', 'SV 1043', '5', at(3, '09:00'), 90),
];

export const taskDelays: TaskDelay[] = [
  { id: 'b0000000-0000-4000-8000-000000000001', task_id: T(2), reported_by: IDS.users.ahmed, reason: 'flight_delayed', delay_min: 40, note: 'Saudia updated ETA', previous_status: 'en_route', new_estimated_start: at(0, '13:25'), resolved_at: null, created_at: at(0, '13:31') },
];

function conflict(n: number, taskId: string, otherTaskId: string | null, driverId: string, type: TaskConflict['type'], severity: TaskConflict['severity'], details: TaskConflict['details']): TaskConflict {
  return { id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, task_id: taskId, other_task_id: otherTaskId, driver_id: driverId, vehicle_id: null, type, severity, details, resolved_at: null, created_at: at(0, '07:00') };
}

export const taskConflicts: TaskConflict[] = [
  conflict(1, T(6), T(7), IDS.drivers.yousef, 'driver_overlap', 'blocking', { title: 'JED departure · XY 210', site: 'Jeddah Tower', start: at(0, '12:30'), end: at(0, '15:40') }),
  conflict(2, T(6), null, IDS.drivers.yousef, 'driver_over_hours', 'warning', { planned_min: 340, max_min: 300 }),
  conflict(3, T(7), T(6), IDS.drivers.yousef, 'driver_overlap', 'blocking', { title: 'Escort · Al Rajhi Bank', site: 'Jeddah Tower', start: at(0, '10:30'), end: at(0, '13:00') }),
  conflict(4, T(7), null, IDS.drivers.yousef, 'driver_over_hours', 'warning', { planned_min: 340, max_min: 300 }),
  conflict(5, T(3), null, IDS.drivers.ahmed, 'outside_working_hours', 'info', { shift_start: '07:00:00', shift_end: '17:00:00' }),
  conflict(6, T(9), null, IDS.drivers.fahad, 'outside_working_hours', 'info', { shift_start: '06:00:00', shift_end: '15:00:00' }),
  { ...conflict(7, T(12), null, IDS.drivers.ahmed, 'grade_mixed', 'blocking', { groups: ['A', 'C'] }), driver_id: null },
];

let eventSeq = 0;
function event(taskId: string, type: TaskEvent['type'], actor: string | null, from: TaskEvent['from_status'], to: TaskEvent['to_status'], when: string, payload: TaskEvent['payload'] = {}): TaskEvent {
  return { id: `e0000000-0000-4000-8000-${String(++eventSeq).padStart(12, '0')}`, task_id: taskId, company_id: COMPANY_ID, type, actor_id: actor, from_status: from, to_status: to, lat: null, lng: null, payload, client_ts: when, created_at: when };
}

export const taskEvents: TaskEvent[] = [
  event(T(2), 'created', IDS.users.dispatcher, null, 'scheduled', at(-1, '14:55')),
  event(T(2), 'assigned', IDS.users.dispatcher, 'scheduled', 'assigned', at(-1, '15:00'), { driver_id: IDS.drivers.ahmed }),
  event(T(2), 'acknowledged', IDS.users.ahmed, 'assigned', 'acknowledged', at(-1, '18:11')),
  event(T(2), 'started', IDS.users.ahmed, 'acknowledged', 'en_route', at(0, '12:47')),
  event(T(2), 'delayed', IDS.users.ahmed, 'en_route', 'delayed', at(0, '13:31'), { reason: 'flight_delayed', delay_min: 40 }),
  ...tasks
    .filter((t) => t.id !== T(2) && t.status !== 'scheduled')
    .flatMap((t) => {
      const a = taskAssignments.find((x) => x.task_id === t.id);
      const actor = profiles.find((p) => drivers.find((d) => d.id === a?.driver_id)?.profile_id === p.id)?.id ?? null;
      const list = [event(t.id, 'created', IDS.users.dispatcher, null, 'scheduled', at(-1, '14:30')), event(t.id, 'assigned', a?.assigned_by ?? null, 'scheduled', 'assigned', a?.assigned_at ?? at(-1, '15:00'))];
      if (a?.acknowledged_at) list.push(event(t.id, 'acknowledged', actor, 'assigned', 'acknowledged', a.acknowledged_at));
      if (t.actual_start_at) list.push(event(t.id, 'started', actor, 'acknowledged', 'en_route', t.actual_start_at));
      if (t.status === 'in_progress') list.push(event(t.id, 'arrived', actor, 'en_route', 'in_progress', at(0, '11:04')));
      if (t.actual_end_at) list.push(event(t.id, 'completed', actor, 'en_route', 'completed', t.actual_end_at));
      return list;
    }),
];

function attachment(n: number, taskId: string, p: Partial<TaskAttachment>): TaskAttachment {
  return {
    id: `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    task_id: taskId,
    storage_path: null,
    kind: 'document',
    caption: null,
    title: null,
    category: 'other',
    expires_on: null,
    visible_to_passengers: false,
    file_name: null,
    file_type: null,
    file_size: null,
    uploaded_by: IDS.users.dispatcher,
    created_at: CREATED,
    ...p,
  };
}

export const taskAttachments: TaskAttachment[] = [
  attachment(1, T(4), { storage_path: `${COMPANY_ID}/${T(4)}/receipt.jpg`, kind: 'photo', caption: 'Stamped receipt', uploaded_by: IDS.users.khalid, created_at: at(0, '10:18') }),
  // 0006 trip documents for Sara (demo/… copies render as a placeholder)
  attachment(2, T(2), { title: 'Al Yasmin gate pass', category: 'gate_pass', expires_on: dateKey(30), visible_to_passengers: true, storage_path: 'demo/gate-pass.pdf', file_name: 'gate-pass.pdf', file_type: 'application/pdf' }),
  attachment(3, T(16), { title: 'Hilton Jeddah booking', category: 'hotel_booking', expires_on: dateKey(6), visible_to_passengers: true, storage_path: 'demo/hotel.pdf', file_name: 'hotel.pdf', file_type: 'application/pdf' }),
  attachment(4, T(16), { title: 'Boarding pass SV 1043', category: 'flight_ticket', expires_on: dateKey(3), visible_to_passengers: true, storage_path: 'demo/boarding-pass.pdf', file_name: 'boarding-pass.pdf', file_type: 'application/pdf' }),
  attachment(5, T(16), { title: 'Travel approval (internal)', category: 'other', storage_path: 'demo/approval.pdf', file_name: 'approval.pdf', file_type: 'application/pdf' }),
];

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
let notificationSeq = 0;
function notification(userId: string, type: Notification['type'], taskId: string | null, title: string, body: string | null, minsAgo: number, data: Notification['data'] = {}, read = false): Notification {
  const created = minutesAgo(minsAgo);
  return { id: `f0000000-0000-4000-8000-${String(++notificationSeq).padStart(12, '0')}`, company_id: COMPANY_ID, user_id: userId, type, task_id: taskId, title, body, data, actions: [], channels: ['in_app', 'push'], scheduled_for: created, sent_at: created, read_at: read ? created : null, acted_at: null, created_at: created };
}

export const notifications: Notification[] = [
  // dispatcher (Riyadh HQ + Al Yasmin)
  notification(IDS.users.dispatcher, 'task_delayed', T(2), 'SV 1234 delayed +40 min', 'Ahmed Saleh reported a flight delay', 3, { delay_min: 40, reason: 'flight_delayed' }),
  notification(IDS.users.dispatcher, 'airport_share_hint', T(10), 'Share RUH trip with SV 1234', 'Ahmed Saleh is at RUH 30 min earlier', 12, { related_task_id: T(2), minutes_apart: 30 }),
  notification(IDS.users.dispatcher, 'task_completed', T(1), 'Office shuttle completed', 'Ahmed Saleh · 09:58', 200, {}, true),
  // owner sees everything
  notification(IDS.users.owner, 'task_delayed', T(2), 'SV 1234 delayed +40 min', 'Ahmed Saleh reported a flight delay', 3, { delay_min: 40 }),
  notification(IDS.users.owner, 'conflict_detected', T(7), 'Yousef Rashid double-booked', 'Escort · Al Rajhi Bank overlaps JED · XY 210', 25, { type: 'driver_overlap' }),
  notification(IDS.users.owner, 'driver_not_acknowledged', T(5), 'Khalid Mansour has not acknowledged', 'DMM arrival · MS 691', 40, { driver_id: IDS.drivers.khalid }),
  notification(IDS.users.dammam, 'driver_not_acknowledged', T(5), 'Khalid Mansour has not acknowledged', 'DMM arrival · MS 691', 40, { driver_id: IDS.drivers.khalid }),
  // drivers
  notification(IDS.users.ahmed, 'task_assigned', T(13), 'Office shuttle', null, 300),
  notification(IDS.users.ahmed, 'task_reminder', T(3), 'Escort Mr. Hamad to SAB Bank', null, 20, { offset_min: 120 }),
  notification(IDS.users.khalid, 'task_assigned', T(5), 'DMM arrival · MS 691', null, 380),
  notification(IDS.users.yousef, 'task_assigned', T(7), 'JED departure · XY 210', null, 420),
  notification(IDS.users.fahad, 'task_reminder', T(9), 'Documents to Chamber of Commerce', null, 50, { offset_min: 120 }, true),
  // 0006 — a sign-up to approve, and Hamad's low rating
  notification(IDS.users.owner, 'passenger_registered', null, 'Eng. Laila Hassan', 'laila@masar.dev', 90, { person_id: P(11) }),
  notification(IDS.users.owner, 'low_rating', T(17), 'Escort Mr. Hamad to the Chamber', '2★', 2880, { driver_id: IDS.drivers.fahad, stars: 2 }),
  // 0007 — Sara hears about her trips; dispatch has her request for tomorrow
  notification(IDS.users.sara, 'task_delayed', T(2), 'Pick up Eng. Sara Al-Otaibi', null, 3, { audience: 'passenger' }),
  notification(IDS.users.sara, 'driver_on_the_way', T(2), 'Pick up Eng. Sara Al-Otaibi', null, 60, { audience: 'passenger' }, true),
  notification(IDS.users.sara, 'passenger_trip_assigned', T(16), 'Sara to RUH · SV 1043 to Jeddah', null, 600, { audience: 'passenger' }, true),
  notification(IDS.users.dispatcher, 'trip_request', null, 'Eng. Sara Al-Otaibi', 'Site inspection with the consultant', 45, { request_id: 'b7000000-0000-4000-8000-000000000001', kind: 'new' }),
  notification(IDS.users.owner, 'trip_request', null, 'Eng. Sara Al-Otaibi', 'Site inspection with the consultant', 45, { request_id: 'b7000000-0000-4000-8000-000000000001', kind: 'new' }),
  // fn_document_reminders (0005) — the owner's renewal reminders
  notification(IDS.users.owner, 'document_expired', null, 'Khalid Mansour', 'Driving authorisation', 180, { driver_id: IDS.drivers.khalid, document_type_id: DT(5), days_left: -5, stage: 'expired' }),
  notification(IDS.users.owner, 'document_expiring', null, 'Ahmed Saleh', 'Resident ID (Iqama)', 185, { driver_id: IDS.drivers.ahmed, document_type_id: DT(2), days_left: 20, stage: 'window' }),
  notification(IDS.users.owner, 'document_expiring', null, 'Khalid Mansour', 'Light vehicle driving licence', 186, { driver_id: IDS.drivers.khalid, document_type_id: DT(3), days_left: 25, stage: 'window' }),
  notification(IDS.users.owner, 'document_expiring', null, 'Yousef Rashid', 'Passport', 187, { driver_id: IDS.drivers.yousef, document_type_id: DT(1), days_left: 50, stage: 'window' }),
];

// ---------------------------------------------------------------------------
// hours: 13 days of history + today (driver_day_summary)
// ---------------------------------------------------------------------------
function weekday(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function buildSummaries(): DriverDaySummary[] {
  const rows: DriverDaySummary[] = [];
  drivers.forEach((d, index) => {
    for (let day = -13; day <= 0; day += 1) {
      const date = dateKey(day);
      const dow = weekday(date);
      const isWeekend = companySettings.weekend_days.includes(dow);
      if (isWeekend) continue;
      const n = day + 20 + index;
      const late = n % 3 === 0;
      const driving = day === 0 ? [205, 75, 150, 127][index]! : 120 + 150 + (late ? 180 : 0) + (n % 4) * 10;
      const working = day === 0 ? [360, 75, 150, 127][index]! : late ? 690 : 330 + (n % 4) * 10;
      const km = day === 0 ? [25, 14.6, 0, 26.4][index]! : 63.5 + (n % 7) * 2 + (late ? 18 : 0);
      const first = at(day, '08:00');
      const second = (['airport', 'document_delivery', 'escort'] as const)[n % 3] ?? 'airport';
      rows.push({
        driver_id: d.id,
        company_id: COMPANY_ID,
        date,
        first_start_at: first,
        last_end_at: new Date(new Date(first).getTime() + working * 60_000).toISOString(),
        tasks_count: day === 0 ? 1 : late ? 3 : 2,
        tasks_by_category: day === 0 ? {} : { daily_routine: 1, [second]: 1 },
        driving_min: driving,
        working_min: working,
        overtime_min: Math.max(working - companySettings.standard_day_min, 0),
        distance_km: Math.round(km * 10) / 10,
        is_weekend: false,
        is_holiday: false,
        computed_at: minutesAgo(5),
      });
    }
  });
  return rows;
}

export const driverDaySummaries: DriverDaySummary[] = buildSummaries();

export const holidays: Holiday[] = [
  { id: 'ab000000-0000-4000-8000-000000000001', company_id: COMPANY_ID, date: `${TODAY.slice(0, 4)}-02-22`, name: 'Founding Day', name_ar: 'يوم التأسيس' },
  { id: 'ab000000-0000-4000-8000-000000000002', company_id: COMPANY_ID, date: `${TODAY.slice(0, 4)}-09-23`, name: 'Saudi National Day', name_ar: 'اليوم الوطني' },
];

// ---------------------------------------------------------------------------
// ratings (0006) — the company's rating options (seeded like
// fn_seed_rating_options) and Hamad's low rating of Fahad
// ---------------------------------------------------------------------------
const RO = (n: number) => `17000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function option(n: number, category: string, code: string, label: string, label_ar: string, score: number | null, alerts: boolean, sort: number): RatingOption {
  return { id: RO(n), company_id: COMPANY_ID, category, code, label, label_ar, score, alerts, sort, is_active: true };
}

export const ratingOptions: RatingOption[] = [
  option(1, 'driving', 'smooth', 'Smooth and safe driving', 'قيادة سلسة وآمنة', 5, false, 1),
  option(2, 'driving', 'speeding', 'Speeding', 'سرعة زائدة', 2, false, 2),
  option(3, 'driving', 'harsh', 'Harsh braking or acceleration', 'فرملة أو تسارع مفاجئ', 2, false, 3),
  option(4, 'driving', 'phone', 'Phone use while driving', 'استخدام الهاتف أثناء القيادة', 1, true, 4),
  option(5, 'driving', 'ignored_rules', 'Ignored traffic rules or signals', 'تجاهل قواعد أو إشارات المرور', 1, false, 5),
  option(6, 'trip', 'on_time', 'On time and as planned', 'في الموعد وكما هو مخطط', null, false, 1),
  option(7, 'trip', 'delayed', 'Delayed pickup or arrival', 'تأخر في الاستلام أو الوصول', null, false, 2),
  option(8, 'trip', 'wrong_route', 'Wrong route or unnecessary detour', 'طريق خاطئ أو التفاف غير ضروري', null, false, 3),
  option(9, 'trip', 'comfortable', 'Comfortable and pleasant trip', 'رحلة مريحة وممتعة', null, false, 4),
  option(10, 'trip', 'unprofessional', 'Unprofessional driver conduct', 'سلوك غير مهني من السائق', null, false, 5),
  option(11, 'road', 'clear', 'Clear roads', 'طرق خالية', null, false, 1),
  option(12, 'road', 'congestion', 'Heavy traffic congestion', 'ازدحام مروري شديد', null, false, 2),
  option(13, 'road', 'roadworks', 'Roadworks or diversions', 'أعمال طرق أو تحويلات', null, false, 3),
  option(14, 'road', 'poor_road', 'Poor road condition', 'حالة الطريق سيئة', null, false, 4),
  option(15, 'road', 'weather', 'Weather impact (rain, fog, sandstorm)', 'تأثير الطقس (مطر، ضباب، عاصفة رملية)', null, false, 5),
  option(16, 'cleanliness', 'clean', 'Clean and tidy', 'نظيفة ومرتبة', null, false, 1),
  option(17, 'cleanliness', 'odor', 'Unpleasant odor', 'رائحة غير مستحبة', null, false, 2),
  option(18, 'cleanliness', 'dirty_seats', 'Dirty seats or floor', 'مقاعد أو أرضية متسخة', null, false, 3),
  option(19, 'cleanliness', 'trash', 'Trash left inside', 'نفايات متروكة بالداخل', null, false, 4),
  option(20, 'cleanliness', 'dirty_ext', 'Dirty exterior', 'الهيكل الخارجي متسخ', null, false, 5),
  option(21, 'vehicle', 'excellent', 'Excellent condition', 'حالة ممتازة', null, false, 1),
  option(22, 'vehicle', 'worn', 'Old or worn out', 'قديمة أو مستهلكة', null, false, 2),
  option(23, 'vehicle', 'body_damage', 'Visible body damage', 'أضرار ظاهرة في الهيكل', null, false, 3),
  option(24, 'vehicle', 'interior', 'Interior malfunction (AC, seats, windows)', 'عطل داخلي (تكييف، مقاعد، نوافذ)', null, false, 4),
  option(25, 'vehicle', 'safety', 'Safety concern (seatbelts, tires, lights)', 'مشكلة سلامة (أحزمة، إطارات، أضواء)', null, true, 5),
];

const optionId = (category: string, code: string) => ratingOptions.find((o) => o.category === category && o.code === code)!.id;

export const tripRatings: TripRating[] = [
  {
    id: '18000000-0000-4000-8000-000000000001',
    company_id: COMPANY_ID,
    task_id: T(17),
    person_id: P(2),
    driver_id: IDS.drivers.fahad,
    vehicle_id: IDS.vehicles.camry,
    stars: 2,
    comment: 'Braked hard several times; the back seat was not clean.',
    photo_paths: [],
    is_low: true,
    editable_until: at(-1, '11:00'),
    created_at: at(-2, '11:10'),
    updated_at: at(-2, '11:10'),
  },
];

export const tripRatingChoices: TripRatingChoice[] = [
  ['driving', 'harsh'],
  ['trip', 'on_time'],
  ['cleanliness', 'dirty_seats'],
  ['vehicle', 'excellent'],
].map(([category, code]) => ({ rating_id: '18000000-0000-4000-8000-000000000001', option_id: optionId(category!, code!) }));
