/**
 * Demo-mode mirror of migration 0006 (rpc_passenger_home, rpc_submit_rating,
 * rpc_review_registration, rpc_update_my_profile, rpc_passenger_register,
 * fn_driver_rating; 0007 extras from passenger-trips.ts) over the in-memory store — keep in sync with the SQL.
 * Errors carry the same i18n keys.
 */
import { AppError } from '@/lib/data-source';
import { readPassengers } from '@/features/grades/rules';
import { firstName, SINGLE_CHOICE, type PassengerHome, type PassengerTrip, type RatingCategory } from '@/features/passenger/types';
import { mockDb } from './db';
import { isTripLive, passengerTripExtras } from './passenger-trips';
import type { Notification, Person } from './fixtures';

const HOUR = 3_600_000;

function notify(n: Omit<Notification, 'id' | 'company_id' | 'actions' | 'channels' | 'scheduled_for' | 'sent_at' | 'read_at' | 'acted_at' | 'created_at' | 'task_id' | 'body' | 'data'> & Partial<Notification>) {
  const now = new Date().toISOString();
  mockDb.notifications.push({
    id: crypto.randomUUID(),
    company_id: mockDb.company.id,
    task_id: null,
    body: null,
    data: {},
    actions: [],
    channels: ['in_app', 'push'],
    scheduled_for: now,
    sent_at: null,
    read_at: null,
    acted_at: null,
    created_at: now,
    ...n,
  });
}

const admins = () => mockDb.profiles.filter((p) => (p.role === 'owner' || p.role === 'admin') && p.is_active);

/** fn_driver_rating — averages only, never who rated. */
export function mockDriverRating(driverId: string) {
  const ratings = mockDb.tripRatings.filter((r) => r.driver_id === driverId);
  const driving = mockDb.tripRatingChoices
    .filter((c) => ratings.some((r) => r.id === c.rating_id))
    .map((c) => mockDb.ratingOptions.find((o) => o.id === c.option_id))
    .filter((o) => o?.category === 'driving' && o.score != null)
    .map((o) => o!.score!);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return { ratings: ratings.length, stars: avg(ratings.map((r) => r.stars)), driving: avg(driving) };
}

function personOf(profileId: string) {
  return mockDb.people.find((p) => p.profile_id === profileId) ?? null;
}

/** rpc_passenger_home */
export function mockPassengerHome(profileId: string, now = Date.now()): PassengerHome {
  const person = personOf(profileId);
  if (!person) throw new AppError('errors.forbidden', 'errors.forbidden');
  if (person.registration_status !== 'approved') {
    return { status: (person.registration_status as PassengerHome['status']) ?? null, note: person.registration_note, trips: [] };
  }
  const trips: PassengerTrip[] = mockDb.tasks
    .filter((t) => t.status !== 'draft' && new Date(t.scheduled_start).getTime() > now - 60 * 24 * HOUR)
    .filter((t) => readPassengers(t.passengers).some((p) => p.person_id === person.id))
    .map((t) => {
      const site = mockDb.sites.find((s) => s.id === t.site_id)!;
      const flight = mockDb.flightDetails.find((f) => f.task_id === t.id);
      const airport = flight ? mockDb.airports.find((a) => a.id === flight.airport_id) : undefined;
      const assignment = mockDb.taskAssignments.find((a) => a.task_id === t.id && a.is_primary);
      const driver = mockDb.drivers.find((d) => d.id === assignment?.driver_id);
      const vehicle = mockDb.vehicles.find((v) => v.id === assignment?.vehicle_id);
      const licence = driver
        ? mockDb.driverDocuments
            .filter((d) => d.driver_id === driver.id)
            .map((d) => mockDb.documentTypes.find((x) => x.id === d.document_type_id))
            .find((x) => x?.is_driving_licence)
        : undefined;
      const rating = mockDb.tripRatings.find((r) => r.task_id === t.id && r.person_id === person.id);
      return {
        id: t.id,
        title: t.title,
        category: t.category,
        status: t.status,
        scheduled_start: t.scheduled_start,
        scheduled_end: t.scheduled_end,
        duration_min: t.estimated_duration_min ?? (t.scheduled_end ? Math.round((new Date(t.scheduled_end).getTime() - new Date(t.scheduled_start).getTime()) / 60_000) : null),
        actual_start_at: t.actual_start_at,
        actual_end_at: t.actual_end_at,
        site: { name: site.name, name_ar: site.name_ar },
        stops: mockDb.taskStops
          .filter((s) => s.task_id === t.id)
          .sort((a, b) => a.seq - b.seq)
          .map((s) => ({ seq: s.seq, label: s.label, address: s.address, lat: s.lat, lng: s.lng, planned_arrival_at: s.planned_arrival_at, dwell_min: s.dwell_min })),
        flight: flight
          ? {
              flight_no: flight.flight_no,
              airline: flight.airline,
              direction: flight.direction,
              terminal: flight.terminal,
              scheduled_time: flight.scheduled_time,
              estimated_time: flight.estimated_time,
              airport: airport?.iata ?? null,
              airport_name: airport?.name ?? null,
              airport_name_ar: airport?.name_ar ?? null,
            }
          : null,
        driver: driver
          ? {
              id: driver.id,
              name: driver.full_name,
              name_ar: driver.full_name_ar,
              photo_url: driver.photo_url,
              nationality: driver.nationality,
              english_rating: driver.english_rating,
              licence: licence ? { name: licence.name, name_ar: licence.name_ar } : null,
              rating: mockDriverRating(driver.id),
            }
          : null,
        vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, plate_no: vehicle.plate_no, color: vehicle.color } : null,
        contact_phone: isTripLive(t, now) ? site.contact_phone : null,
        co_passengers: readPassengers(t.passengers).map((p, i) => ({ first_name: firstName(p.name), pickup_order: i + 1, me: p.person_id === person.id })),
        documents: mockDb.taskAttachments
          .filter((a) => a.task_id === t.id && a.visible_to_passengers)
          .map((a) => ({ id: a.id, title: a.title, category: a.category, expires_on: a.expires_on, file_name: a.file_name, file_type: a.file_type, storage_path: a.storage_path })),
        my_rating: rating
          ? {
              id: rating.id,
              stars: rating.stars,
              comment: rating.comment,
              editable_until: rating.editable_until,
              option_ids: mockDb.tripRatingChoices.filter((c) => c.rating_id === rating.id).map((c) => c.option_id),
            }
          : null,
        ...passengerTripExtras(t, person.id, now),
      };
    })
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  return { status: 'approved', person_id: person.id, trips };
}

export interface RatingInput {
  taskId: string;
  stars: number;
  optionIds: string[];
  comment?: string;
  photoPaths?: string[];
}

/** rpc_submit_rating */
export function mockSubmitRating(profileId: string, input: RatingInput): string {
  const person = personOf(profileId);
  if (!person || person.registration_status !== 'approved') throw new AppError('errors.forbidden', 'errors.forbidden');
  const task = mockDb.tasks.find((t) => t.id === input.taskId);
  if (!task || !readPassengers(task.passengers).some((p) => p.person_id === person.id)) throw new AppError('errors.forbidden', 'errors.forbidden');
  if (task.status !== 'completed') throw new AppError('rating.errors.notFinished');
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new AppError('rating.errors.stars');
  const options = input.optionIds.map((id) => mockDb.ratingOptions.find((o) => o.id === id && o.is_active));
  if (options.some((o) => !o)) throw new AppError('errors.invalidInput');
  for (const category of SINGLE_CHOICE) {
    if (options.filter((o) => o!.category === category).length > 1) throw new AppError('rating.errors.oneChoice');
  }

  const settings = mockDb.companySettings;
  const assignment = mockDb.taskAssignments.find((a) => a.task_id === task.id && a.is_primary);
  const reasons = options.filter((o) => o!.alerts).map((o) => o!.code);
  const low = input.stars <= settings.low_rating_threshold || reasons.length > 0;
  const now = new Date();
  let rating = mockDb.tripRatings.find((r) => r.task_id === task.id && r.person_id === person.id);
  if (rating && now.getTime() > new Date(rating.editable_until).getTime()) throw new AppError('rating.errors.locked');

  if (rating) {
    Object.assign(rating, { stars: input.stars, comment: input.comment?.trim() || null, photo_paths: input.photoPaths ?? [], is_low: low, updated_at: now.toISOString() });
  } else {
    rating = {
      id: crypto.randomUUID(),
      company_id: task.company_id,
      task_id: task.id,
      person_id: person.id,
      driver_id: assignment?.driver_id ?? null,
      vehicle_id: assignment?.vehicle_id ?? null,
      stars: input.stars,
      comment: input.comment?.trim() || null,
      photo_paths: input.photoPaths ?? [],
      is_low: low,
      editable_until: new Date(now.getTime() + settings.rating_edit_hours * HOUR).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    mockDb.tripRatings.push(rating);
  }
  const ratingId = rating.id;
  mockDb.tripRatingChoices = [
    ...mockDb.tripRatingChoices.filter((c) => c.rating_id !== ratingId),
    ...input.optionIds.map((option_id) => ({ rating_id: ratingId, option_id })),
  ];
  if (low && !mockDb.notifications.some((n) => n.type === 'low_rating' && (n.data as { rating_id?: string })?.rating_id === ratingId)) {
    for (const a of admins()) {
      notify({
        user_id: a.id,
        type: 'low_rating',
        task_id: task.id,
        title: task.title,
        body: reasons.length ? reasons.join(',') : `${input.stars}★`,
        data: { rating_id: ratingId, driver_id: assignment?.driver_id ?? null, stars: input.stars, reasons: reasons.join(',') || null },
      });
    }
  }
  return ratingId;
}

/** rpc_review_registration */
export function mockReviewRegistration(personId: string, approve: boolean, note?: string) {
  const person = mockDb.people.find((p) => p.id === personId);
  if (!person?.profile_id) throw new AppError('errors.invalidInput');
  person.registration_status = approve ? 'approved' : 'rejected';
  person.registration_note = note?.trim() || null;
  notify({ user_id: person.profile_id, type: approve ? 'registration_approved' : 'registration_rejected', title: person.full_name, body: person.registration_note });
}

/** rpc_update_my_profile */
export function mockUpdateMyProfile(profileId: string, p: { phone?: string; language?: 'en' | 'ar'; accessibility_needs?: string; ride_preferences?: string[]; photo_url?: string }) {
  const person = personOf(profileId);
  if (!person) throw new AppError('errors.forbidden', 'errors.forbidden');
  if (p.phone?.trim()) person.phone = p.phone.trim();
  if (p.language) person.language = p.language;
  if (p.accessibility_needs !== undefined) person.accessibility_needs = p.accessibility_needs.trim() || null;
  if (p.ride_preferences) person.ride_preferences = p.ride_preferences;
  if (p.photo_url !== undefined) person.photo_url = p.photo_url || null;
  const profile = mockDb.profiles.find((x) => x.id === profileId);
  if (profile && p.language) profile.language = p.language;
}

/**
 * rpc_passenger_register for a demo sign-up: a new profile + pending person
 * (company e-mail domain or join code + employee ID). Resolves the new profile id.
 */
export function mockPassengerRegister(input: { email: string; fullName: string; phone?: string; employeeNo?: string; joinCode?: string; language: 'en' | 'ar' }): string {
  const settings = mockDb.companySettings;
  const email = input.email.trim().toLowerCase();
  if (mockDb.profiles.some((p) => p.email === email)) throw new AppError('exists', 'users.errors.alreadyRegistered');
  if (!input.fullName.trim()) throw new AppError('people.errors.name');
  let person: Person | null;
  if (input.joinCode?.trim()) {
    if (input.joinCode.trim().toUpperCase() !== settings.passenger_join_code?.toUpperCase()) throw new AppError('passenger.errors.joinCode');
    if (!input.employeeNo?.trim()) throw new AppError('passenger.errors.employeeNo');
    person = mockDb.people.find((p) => p.employee_no === input.employeeNo!.trim() && !p.profile_id) ?? null;
    if (!person) throw new AppError('passenger.errors.employeeNotFound');
  } else if (!settings.passenger_email_domains.includes(email.split('@')[1] ?? '')) {
    throw new AppError('passenger.errors.domain');
  } else {
    person = mockDb.people.find((p) => p.email?.toLowerCase() === email && !p.profile_id) ?? null;
  }
  const now = new Date().toISOString();
  const profileId = crypto.randomUUID();
  mockDb.profiles.push({
    id: profileId,
    company_id: mockDb.company.id,
    role: 'passenger',
    full_name: input.fullName.trim(),
    full_name_ar: null,
    email,
    phone: input.phone?.trim() || null,
    language: input.language,
    avatar_url: null,
    is_active: true,
    notif_in_app: true,
    notif_push: true,
    notif_email: false,
    created_at: now,
    updated_at: now,
  });
  if (!person) {
    person = {
      id: crypto.randomUUID(),
      company_id: mockDb.company.id,
      employee_no: null,
      full_name: input.fullName.trim(),
      full_name_ar: null,
      grade: null,
      job_title: null,
      department: null,
      site_id: null,
      phone: input.phone?.trim() || null,
      email,
      is_active: true,
      notes: null,
      source: 'self',
      profile_id: null,
      registration_status: null,
      registration_note: null,
      photo_url: null,
      language: input.language,
      accessibility_needs: null,
      ride_preferences: [],
      created_by: profileId,
      created_at: now,
      updated_at: now,
    };
    mockDb.people.push(person);
  }
  Object.assign(person, { profile_id: profileId, registration_status: 'pending', language: input.language });
  for (const a of admins()) notify({ user_id: a.id, type: 'passenger_registered', title: input.fullName.trim(), body: email, data: { person_id: person.id } });
  return profileId;
}

/** Choices grouped by category, for the rating page and the dashboard. */
export function optionsByCategory() {
  const out: Partial<Record<RatingCategory, typeof mockDb.ratingOptions>> = {};
  for (const o of mockDb.ratingOptions) (out[o.category as RatingCategory] ??= []).push(o);
  return out;
}
