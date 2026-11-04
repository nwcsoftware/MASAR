import { describe, expect, it } from 'vitest';
import { firstName, needsRating, type PassengerTrip } from '@/features/passenger/types';
import { passengerSignUpSchema } from '@/features/passenger/schema';
import { mockDb } from '@/mocks/db';
import { IDS } from '@/mocks/fixtures';
import {
  mockDriverRating,
  mockPassengerHome,
  mockPassengerRegister,
  mockReviewRegistration,
  mockSubmitRating,
  mockUpdateMyProfile,
} from '@/mocks/passenger';

// demo mirror of 0006 — keep in sync with supabase/tests/0006_passengers.test.sql
const SARA = IDS.users.sara;
const T = IDS.tasks;
const option = (category: string, code: string) => mockDb.ratingOptions.find((o) => o.category === category && o.code === code)!.id;

describe('passenger trip view (rpc_passenger_home)', () => {
  it('lists Sara’s three trips with a masked driver card', () => {
    const home = mockPassengerHome(SARA);
    expect(home.status).toBe('approved');
    expect(home.trips.map((t) => t.id).sort()).toEqual([T[2], T[15], T[16]].sort());
    for (const trip of home.trips) expect(trip.driver && 'phone' in trip.driver).toBe(false);
    const jeddah = home.trips.find((t) => t.id === T[16])!;
    expect(jeddah.driver).toMatchObject({ name: 'Ahmed Saleh', nationality: 'Saudi', english_rating: 4, licence: { name: 'Light vehicle driving licence' } });
    expect(jeddah.documents.map((d) => d.title)).toEqual(['Hilton Jeddah booking', 'Boarding pass SV 1043']); // the internal one is hidden
    expect(jeddah.flight).toMatchObject({ flight_no: 'SV 1043', direction: 'departure', airport: 'RUH' });
    expect(jeddah.co_passengers).toEqual([{ first_name: 'Sara', pickup_order: 1, me: true }]);
  });

  it('pending sign-ups see no trips; the dispatch line shows only during an active trip', () => {
    expect(mockPassengerHome(IDS.users.laila)).toMatchObject({ status: 'pending', trips: [] });
    const home = mockPassengerHome(SARA);
    expect(home.trips.find((t) => t.id === T[16])!.contact_phone).toBeNull(); // in three days
    expect(home.trips.find((t) => t.id === T[15])!.contact_phone).toBeNull(); // finished
  });

  it('prompts for a rating after a trip ends, for a week', () => {
    const trip = { status: 'completed', my_rating: null, actual_end_at: new Date(Date.now() - 86_400_000).toISOString(), scheduled_end: null, scheduled_start: '' } as unknown as PassengerTrip;
    expect(needsRating(trip)).toBe(true);
    expect(needsRating({ ...trip, actual_end_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })).toBe(false);
    expect(needsRating({ ...trip, status: 'en_route' })).toBe(false);
    expect(firstName('Eng. Sara Al-Otaibi')).toBe('Sara');
  });
});

describe('ratings (rpc_submit_rating)', () => {
  it('only finished trips of your own, one answer per single-choice group, 1–5 stars', () => {
    expect(() => mockSubmitRating(SARA, { taskId: T[2]!, stars: 4, optionIds: [] })).toThrow('rating.errors.notFinished');
    expect(() => mockSubmitRating(SARA, { taskId: T[17]!, stars: 4, optionIds: [] })).toThrow('errors.forbidden');
    expect(() => mockSubmitRating(SARA, { taskId: T[15]!, stars: 4, optionIds: [option('driving', 'smooth'), option('driving', 'speeding')] })).toThrow('rating.errors.oneChoice');
    expect(() => mockSubmitRating(SARA, { taskId: T[15]!, stars: 6, optionIds: [] })).toThrow('rating.errors.stars');
  });

  it('a "phone use" rating is low and alerts the owners once, even after an edit', () => {
    const before = mockDb.notifications.filter((n) => n.type === 'low_rating').length;
    const id = mockSubmitRating(SARA, { taskId: T[15]!, stars: 4, optionIds: [option('driving', 'phone'), option('cleanliness', 'clean'), option('cleanliness', 'odor')], comment: 'On the phone' });
    mockSubmitRating(SARA, { taskId: T[15]!, stars: 3, optionIds: [option('driving', 'phone')] });
    expect(mockDb.tripRatings.filter((r) => r.task_id === T[15])).toHaveLength(1);
    expect(mockDb.tripRatings.find((r) => r.id === id)).toMatchObject({ stars: 3, is_low: true });
    const alerts = mockDb.notifications.filter((n) => n.type === 'low_rating').length - before;
    expect(alerts).toBe(mockDb.profiles.filter((p) => p.role === 'owner' || p.role === 'admin').length);
  });

  it('locks after the edit window; drivers get averages, never identities', () => {
    const rating = mockDb.tripRatings.find((r) => r.task_id === T[15])!;
    rating.editable_until = new Date(Date.now() - 60_000).toISOString();
    expect(() => mockSubmitRating(SARA, { taskId: T[15]!, stars: 5, optionIds: [] })).toThrow('rating.errors.locked');
    const ahmed = mockDriverRating(IDS.drivers.ahmed);
    expect(ahmed).toEqual({ ratings: 1, stars: 3, driving: 1 });
    expect(Object.keys(ahmed)).not.toContain('person_id');
  });
});

describe('registration (rpc_passenger_register / rpc_review_registration)', () => {
  it('validates the sign-up form', () => {
    const base = { fullName: 'Omar New', email: 'omar@masar.dev', password: 'secret123', method: 'email', language: 'en', needsPassword: true };
    expect(passengerSignUpSchema.safeParse(base).success).toBe(true);
    const issues = passengerSignUpSchema.safeParse({ ...base, method: 'employee', password: 'x' }).error?.issues.map((i) => i.message);
    expect(issues).toEqual(expect.arrayContaining(['auth.errors.passwordShort', 'passenger.errors.employeeNo', 'passenger.errors.joinCodeRequired']));
  });

  it('company domain or join code + employee ID; pending until an admin approves', () => {
    expect(() => mockPassengerRegister({ email: 'x@gmail.com', fullName: 'X', language: 'en' })).toThrow('passenger.errors.domain');
    expect(() => mockPassengerRegister({ email: 'k@gmail.com', fullName: 'K', joinCode: 'nope', employeeNo: 'E-1005', language: 'en' })).toThrow('passenger.errors.joinCode');
    expect(() => mockPassengerRegister({ email: 'k@gmail.com', fullName: 'K', joinCode: 'masar-2026', employeeNo: 'E-9999', language: 'en' })).toThrow('passenger.errors.employeeNotFound');

    const karim = mockPassengerRegister({ email: 'karim@gmail.com', fullName: 'Karim Haddad', joinCode: 'masar-2026', employeeNo: 'E-1005', language: 'ar' });
    const person = mockDb.people.find((p) => p.profile_id === karim)!;
    expect(person).toMatchObject({ employee_no: 'E-1005', registration_status: 'pending' });
    expect(mockPassengerHome(karim)).toMatchObject({ status: 'pending', trips: [] });

    mockReviewRegistration(person.id, true);
    expect(mockPassengerHome(karim).status).toBe('approved');
    expect(mockDb.notifications.some((n) => n.user_id === karim && n.type === 'registration_approved')).toBe(true);
  });

  it('a passenger edits preferences, not their grade', () => {
    mockUpdateMyProfile(SARA, { language: 'ar', ride_preferences: ['quiet'], accessibility_needs: 'Wheelchair' });
    expect(mockDb.people.find((p) => p.profile_id === SARA)).toMatchObject({ language: 'ar', ride_preferences: ['quiet'], accessibility_needs: 'Wheelchair', grade: 14 });
  });
});
