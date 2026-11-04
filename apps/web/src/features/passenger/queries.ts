import { useQuery } from '@tanstack/react-query';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/features/auth/session';
import { peopleKeys } from '@/features/people/queries';
import { taskKeys } from '@/features/tasks/queries';
import { AppError, db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery } from '@/mocks/db';
import type { EmergencyContact, RatingOption, SosEvent, TaskAttachment, TaskPassenger, TripRating, TripRatingChoice, TripRequest } from '@/mocks/fixtures';
import {
  mockPassengerHome,
  mockPassengerRegister,
  mockReviewRegistration,
  mockSubmitRating,
  mockUpdateMyProfile,
} from '@/mocks/passenger';
import {
  mockCreateShareLink,
  mockDecideRequest,
  mockDriverCheckIn,
  mockDriverDropOff,
  mockPassengerLive,
  mockPassengerRequest,
  mockPassengerSos,
  mockRevokeShareLink,
  mockSharedTrip,
  mockSosEvents,
  mockSosUpdate,
  mockTripRequests,
  mockWithdrawRequest,
  onTripDocument,
  taskPassengers,
  type CheckInResult,
} from '@/mocks/passenger-trips';
import type { MockActor } from '@/mocks/task-writes';
import type { LiveTrip, PassengerHome, SharedTrip, SosResult, TripDocumentCategory, TripRequestInput } from './types';

export const RATING_PHOTOS = 'rating-photos';
export const TRIP_DOCUMENTS = 'task-attachments';
const MAX_PHOTOS = 4;

export const passengerKeys = {
  home: (userId: string) => ['passenger', userId, 'home'] as const,
  contacts: (userId: string) => ['passenger', userId, 'contacts'] as const,
  ratingOptions: (companyId: string) => ['ratings', companyId, 'options'] as const,
  ratings: (companyId: string) => ['ratings', companyId, 'all'] as const,
  live: (userId: string, taskId: string) => ['passenger', userId, 'live', taskId] as const,
  requests: (companyId: string, userId: string) => ['requests', companyId, userId] as const,
  sos: (companyId: string) => ['sos', companyId] as const,
  riders: (companyId: string, taskId: string) => ['tasks', companyId, 'riders', taskId] as const,
};

function useActor(): MockActor {
  const user = useCurrentUser();
  return { id: user.id, role: user.profile.role, siteIds: user.siteIds };
}

const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-60);

// ---------------------------------------------------------------------------
// passenger side
// ---------------------------------------------------------------------------
/** rpc_passenger_home — status + the passenger's trips (scoped, masked). */
export function usePassengerHome() {
  const user = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.home(user.id),
    queryFn: async (): Promise<PassengerHome> =>
      live
        ? (unwrap(await db().rpc('rpc_passenger_home')) as unknown as PassengerHome)
        : mockQuery(() => mockPassengerHome(user.id), { status: 'approved', trips: [] }),
  });
}

/** The company's rating options (passengers read them to rate; admins edit them). */
export function useRatingOptions() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.ratingOptions(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('rating_options').select('*').order('category').order('sort')) ?? [])
        : mockQuery<RatingOption[]>(() => [...mockDb.ratingOptions].sort((a, b) => a.category.localeCompare(b.category) || a.sort - b.sort), []),
  });
}

export interface SubmitRatingInput {
  taskId: string;
  personId: string;
  stars: number;
  optionIds: string[];
  comment?: string;
  /** new photos to attach (vehicle issues) */
  photos?: File[];
  /** photos already on the rating (kept on edit) */
  keepPhotoPaths?: string[];
}

/** rpc_submit_rating (+ photos into the private rating-photos bucket). */
export function useSubmitRating() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<SubmitRatingInput, string>({
    live: async (input) => {
      const paths = [...(input.keepPhotoPaths ?? [])];
      for (const photo of (input.photos ?? []).slice(0, MAX_PHOTOS)) {
        const path = `${companyId}/${input.personId}/${crypto.randomUUID()}-${safeName(photo.name)}`;
        unwrap(await db().storage.from(RATING_PHOTOS).upload(path, photo, { contentType: photo.type }));
        paths.push(path);
      }
      return unwrap(
        await db().rpc('rpc_submit_rating', {
          p_task_id: input.taskId,
          p_stars: input.stars,
          p_option_ids: input.optionIds,
          p_comment: input.comment ?? undefined,
          p_photo_paths: paths,
        }),
      )!;
    },
    mock: (input) =>
      mockSubmitRating(user.id, {
        taskId: input.taskId,
        stars: input.stars,
        optionIds: input.optionIds,
        comment: input.comment,
        photoPaths: [...(input.keepPhotoPaths ?? []), ...(input.photos ?? []).slice(0, MAX_PHOTOS).map((f) => URL.createObjectURL(f))],
      }),
    invalidate: () => [passengerKeys.home(user.id), passengerKeys.ratings(companyId)],
  });
}

export interface MyProfileInput {
  phone?: string;
  language?: 'en' | 'ar';
  accessibility_needs?: string;
  ride_preferences?: string[];
  photo?: File | null;
}

/** rpc_update_my_profile — preferences only (grade and company stay with the admin). */
export function useUpdateMyProfile() {
  const user = useCurrentUser();
  return useDualMutation<MyProfileInput, void>({
    live: async ({ photo, ...rest }) => {
      let photo_url: string | undefined;
      if (photo) {
        const path = `${user.id}/${crypto.randomUUID()}-${safeName(photo.name)}`;
        unwrap(await db().storage.from('avatars').upload(path, photo, { contentType: photo.type }));
        photo_url = db().storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
      unwrap(await db().rpc('rpc_update_my_profile', { p: { ...rest, ...(photo_url ? { photo_url } : {}) } }));
    },
    mock: ({ photo, ...rest }) => mockUpdateMyProfile(user.id, { ...rest, ...(photo ? { photo_url: URL.createObjectURL(photo) } : {}) }),
    invalidate: () => [passengerKeys.home(user.id), ['session']],
  });
}

/** The passenger's own directory row (RLS: own only) — profile screen. */
export function useMyPerson() {
  const user = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: ['passenger', user.id, 'person'],
    queryFn: async () =>
      live
        ? unwrap(await db().from('people').select('*').eq('profile_id', user.id).maybeSingle())
        : mockQuery(() => mockDb.people.find((p) => p.profile_id === user.id) ?? null, null),
  });
}

export function useEmergencyContacts(personId: string | undefined) {
  const user = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.contacts(user.id),
    enabled: Boolean(personId),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('emergency_contacts').select('*').eq('person_id', personId!).order('created_at')) ?? [])
        : mockQuery<EmergencyContact[]>(() => mockDb.emergencyContacts.filter((c) => c.person_id === personId), []),
  });
}

export function useAddEmergencyContact() {
  const user = useCurrentUser();
  return useDualMutation<{ personId: string; name: string; relation?: string; phone: string }, void>({
    live: async ({ personId, name, relation, phone }) => {
      unwrap(await db().from('emergency_contacts').insert({ person_id: personId, name, relation: relation || null, phone }));
    },
    mock: ({ personId, name, relation, phone }) => {
      mockDb.emergencyContacts.push({ id: crypto.randomUUID(), person_id: personId, name, relation: relation || null, phone, created_at: new Date().toISOString() });
    },
    invalidate: () => [passengerKeys.contacts(user.id)],
  });
}

export function useDeleteEmergencyContact() {
  const user = useCurrentUser();
  return useDualMutation<string, void>({
    live: async (id) => {
      unwrap(await db().from('emergency_contacts').delete().eq('id', id));
    },
    mock: (id) => {
      mockDb.emergencyContacts = mockDb.emergencyContacts.filter((c) => c.id !== id);
    },
    invalidate: () => [passengerKeys.contacts(user.id)],
  });
}

// ---------------------------------------------------------------------------
// staff side
// ---------------------------------------------------------------------------
/** Approve / reject a sign-up (rpc_review_registration, owner/admin). */
export function useReviewRegistration() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ personId: string; approve: boolean; note?: string }, void>({
    live: async ({ personId, approve, note }) => {
      unwrap(await db().rpc('rpc_review_registration', { p_person_id: personId, p_approve: approve, p_note: note }));
    },
    mock: ({ personId, approve, note }) => mockReviewRegistration(personId, approve, note),
    invalidate: () => [peopleKeys.all(companyId)],
  });
}

export interface TripDocumentInput {
  taskId: string;
  file: File;
  title: string;
  category: TripDocumentCategory;
  expires_on: string | null;
  visible_to_passengers: boolean;
}

/** §4: attach a document to a trip (task_attachments + the task-attachments bucket). */
export function useAddTripDocument() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<TripDocumentInput, void>({
    live: async ({ taskId, file, title, category, expires_on, visible_to_passengers }) => {
      const path = `${companyId}/${taskId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      unwrap(await db().storage.from(TRIP_DOCUMENTS).upload(path, file, { contentType: file.type }));
      const result = await db().from('task_attachments').insert({
        task_id: taskId,
        storage_path: path,
        kind: 'document',
        title,
        category,
        expires_on,
        visible_to_passengers,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (result.error) {
        await db().storage.from(TRIP_DOCUMENTS).remove([path]);
        unwrap(result);
      }
    },
    mock: ({ taskId, file, title, category, expires_on, visible_to_passengers }) => {
      const id = crypto.randomUUID();
      if (visible_to_passengers) onTripDocument(taskId, title, id, user.id);
      mockDb.taskAttachments.push({
        id,
        task_id: taskId,
        storage_path: URL.createObjectURL(file),
        kind: 'document',
        caption: null,
        title,
        category,
        expires_on,
        visible_to_passengers,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
      });
    },
    invalidate: () => [taskKeys.all(companyId)],
  });
}

export function useUpdateTripDocument() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ id: string; visible_to_passengers: boolean }, void>({
    live: async ({ id, visible_to_passengers }) => {
      unwrap(await db().from('task_attachments').update({ visible_to_passengers }).eq('id', id));
    },
    mock: ({ id, visible_to_passengers }) => {
      const doc = mockDb.taskAttachments.find((a) => a.id === id);
      if (doc && visible_to_passengers && !doc.visible_to_passengers) onTripDocument(doc.task_id, doc.title ?? doc.file_name, doc.id, profile.id);
      if (doc) doc.visible_to_passengers = visible_to_passengers;
    },
    invalidate: () => [taskKeys.all(companyId)],
  });
}

export function useDeleteTripDocument() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<TaskAttachment, void>({
    live: async (doc) => {
      unwrap(await db().from('task_attachments').delete().eq('id', doc.id));
      if (doc.storage_path) await db().storage.from(TRIP_DOCUMENTS).remove([doc.storage_path]);
    },
    mock: (doc) => {
      mockDb.taskAttachments = mockDb.taskAttachments.filter((a) => a.id !== doc.id);
    },
    invalidate: () => [taskKeys.all(companyId)],
  });
}

export interface RatingsData {
  ratings: TripRating[];
  choices: TripRatingChoice[];
}

/** Every rating with its passenger (RLS: owners/admins only — §14 anonymity). */
export function useRatings() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.ratings(profile.company_id ?? ''),
    queryFn: async (): Promise<RatingsData> => {
      if (!live) return mockQuery(() => ({ ratings: mockDb.tripRatings, choices: mockDb.tripRatingChoices }), { ratings: [], choices: [] });
      const [ratings, choices] = await Promise.all([
        db().from('trip_ratings').select('*').order('created_at', { ascending: false }).limit(1000),
        db().from('trip_rating_choices').select('*'),
      ]);
      return { ratings: unwrap(ratings) ?? [], choices: unwrap(choices) ?? [] };
    },
  });
}

export function useSaveRatingOption() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ id: string; label: string; label_ar: string | null; alerts: boolean; is_active: boolean }, void>({
    live: async ({ id, ...row }) => {
      unwrap(await db().from('rating_options').update(row).eq('id', id));
    },
    mock: ({ id, ...row }) => {
      const option = mockDb.ratingOptions.find((o) => o.id === id);
      if (option) Object.assign(option, row);
    },
    invalidate: () => [passengerKeys.ratingOptions(companyId)],
  });
}

export interface PassengerSettingsValues {
  passenger_email_domains: string[];
  passenger_join_code: string | null;
  rating_edit_hours: number;
  low_rating_threshold: number;
}

export function useSavePassengerSettings() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<PassengerSettingsValues, void>({
    live: async (values) => {
      const result = await db().from('company_settings').update(values).eq('company_id', companyId);
      if (result.error?.code === '23505') throw new AppError(result.error.message, 'passenger.errors.joinCodeTaken');
      unwrap(result);
    },
    mock: (values) => {
      Object.assign(mockDb.companySettings, values);
    },
    invalidate: () => [['company', companyId, 'settings']],
  });
}

/** Demo-mode passenger sign-up (live sign-up goes through Supabase Auth + rpc_passenger_register). */
export const registerDemoPassenger = mockPassengerRegister;

// ---------------------------------------------------------------------------
// phase 2 (0007) — live view, share link, SOS, requests (passenger side)
// ---------------------------------------------------------------------------
/** rpc_passenger_live — the driver's position + ETA, refreshed every 15 s while the trip is live. */
export function usePassengerLive(taskId: string, enabled: boolean) {
  const user = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.live(user.id, taskId),
    enabled,
    refetchInterval: 15_000,
    queryFn: async (): Promise<LiveTrip> =>
      live
        ? (unwrap(await db().rpc('rpc_passenger_live', { p_task_id: taskId })) as unknown as LiveTrip)
        : mockQuery(() => mockPassengerLive(user.id, taskId), null as unknown as LiveTrip),
  });
}

export function useShareLink() {
  const user = useCurrentUser();
  return useDualMutation<{ taskId: string; revoke?: boolean }, string | null>({
    live: async ({ taskId, revoke }) => {
      if (revoke) {
        unwrap(await db().rpc('rpc_revoke_share_link', { p_task_id: taskId }));
        return null;
      }
      return unwrap(await db().rpc('rpc_create_share_link', { p_task_id: taskId }));
    },
    mock: ({ taskId, revoke }) => {
      if (!revoke) return mockCreateShareLink(user.id, taskId);
      mockRevokeShareLink(user.id, taskId);
      return null;
    },
    invalidate: () => [passengerKeys.home(user.id)],
  });
}

/** The public tracking page — anonymous (anon key), or the demo store. */
export function useSharedTrip(token: string) {
  return useQuery({
    queryKey: ['shared-trip', token],
    refetchInterval: 15_000,
    queryFn: async (): Promise<SharedTrip> => {
      if (supabase) return unwrap(await supabase.rpc('rpc_shared_trip', { p_token: token })) as unknown as SharedTrip;
      return mockSharedTrip(token);
    },
  });
}

export interface SosInput {
  taskId: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  message?: string;
}

/** rpc_passenger_sos — alerts dispatch; returns the contacts to hand the location to. */
export function useRaiseSos() {
  const user = useCurrentUser();
  return useDualMutation<SosInput, SosResult>({
    live: async ({ taskId, lat, lng, accuracy, message }) =>
      unwrap(
        await db().rpc('rpc_passenger_sos', { p_task_id: taskId, p_lat: lat, p_lng: lng, p_accuracy: accuracy, p_message: message }),
      ) as unknown as SosResult,
    mock: ({ taskId, lat, lng, accuracy, message }) => mockPassengerSos(user.id, taskId, { lat, lng, accuracy }, message),
    invalidate: () => [passengerKeys.home(user.id)],
  });
}

/** Trip requests — the passenger's own (RLS), or the inbox for staff of the site. */
export function useTripRequests() {
  const user = useCurrentUser();
  const actor = useActor();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.requests(user.profile.company_id ?? '', user.id),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('trip_requests').select('*').order('created_at', { ascending: false }).limit(500)) ?? [])
        : mockQuery<TripRequest[]>(() => [...mockTripRequests(actor)].sort((a, b) => b.created_at.localeCompare(a.created_at)), []),
  });
}

export function useCreateRequest() {
  const user = useCurrentUser();
  return useDualMutation<TripRequestInput, string>({
    live: async (input) => unwrap(await db().rpc('rpc_passenger_request', { p: input as unknown as Json }))!,
    mock: (input) => mockPassengerRequest(user.id, input),
    invalidate: () => [passengerKeys.requests(user.profile.company_id ?? '', user.id)],
  });
}

export function useWithdrawRequest() {
  const user = useCurrentUser();
  return useDualMutation<string, void>({
    live: async (id) => {
      unwrap(await db().rpc('rpc_withdraw_request', { p_request_id: id }));
    },
    mock: (id) => mockWithdrawRequest(user.id, id),
    invalidate: () => [passengerKeys.requests(user.profile.company_id ?? '', user.id)],
  });
}

// ---------------------------------------------------------------------------
// phase 2 — staff side: requests inbox, SOS
// ---------------------------------------------------------------------------
export interface DecideRequestInput {
  requestId: string;
  approve: boolean;
  note?: string;
  /** a "new trip" request planned in the wizard */
  createdTaskId?: string | null;
  overrideReason?: string | null;
}

export function useDecideRequest() {
  const user = useCurrentUser();
  const actor = useActor();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<DecideRequestInput, void>({
    live: async ({ requestId, approve, note, createdTaskId, overrideReason }) => {
      unwrap(
        await db().rpc('rpc_decide_request', {
          p_request_id: requestId,
          p_approve: approve,
          p_note: note || undefined,
          p_created_task_id: createdTaskId ?? undefined,
          p_override_reason: overrideReason ?? undefined,
        }),
      );
    },
    mock: (input) => mockDecideRequest(actor, input),
    invalidate: () => [['requests', companyId], taskKeys.all(companyId)],
  });
}

/** Open and recent SOS events (RLS: staff of the trip's site). */
export function useSosEvents() {
  const user = useCurrentUser();
  const actor = useActor();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.sos(user.profile.company_id ?? ''),
    refetchInterval: 30_000,
    queryFn: async () =>
      live
        ? (unwrap(await db().from('sos_events').select('*').order('created_at', { ascending: false }).limit(50)) ?? [])
        : mockQuery<SosEvent[]>(() => [...mockSosEvents(actor)].sort((a, b) => b.created_at.localeCompare(a.created_at)), []),
  });
}

export function useSosUpdate() {
  const user = useCurrentUser();
  const actor = useActor();
  return useDualMutation<{ id: string; action: 'acknowledge' | 'resolve'; note?: string }, void>({
    live: async ({ id, action, note }) => {
      unwrap(await db().rpc('rpc_sos_update', { p_sos_id: id, p_action: action, p_note: note || undefined }));
    },
    mock: ({ id, action, note }) => mockSosUpdate(actor, id, action, note),
    invalidate: () => [passengerKeys.sos(user.profile.company_id ?? '')],
  });
}

// ---------------------------------------------------------------------------
// phase 2 — driver side: who to pick up, check-in, drop-off
// ---------------------------------------------------------------------------
export type Rider = Omit<TaskPassenger, 'checkin_code'>;

/** task_passengers for a trip — never the codes (column privileges). */
export function useTaskRiders(taskId: string) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: passengerKeys.riders(profile.company_id ?? '', taskId),
    queryFn: async (): Promise<Rider[]> =>
      live
        ? ((unwrap(
            await db()
              .from('task_passengers')
              .select('id, task_id, company_id, person_id, name, pickup_order, pickup_stop_seq, dropoff_stop_seq, checked_in_at, dropped_off_at, created_at')
              .eq('task_id', taskId)
              .order('pickup_order'),
          ) ?? []) as Rider[])
        : mockQuery(() => taskPassengers(taskId).map(({ checkin_code: _hidden, ...row }) => row), []),
  });
}

export function useCheckIn() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  /** `riderId` (no code) only for riders without the app */
  return useDualMutation<{ taskId: string; code: string; riderId?: string; lat?: number; lng?: number }, CheckInResult>({
    live: async ({ taskId, code, riderId, lat, lng }) =>
      unwrap(
        await db().rpc('rpc_driver_check_in', { p_task_id: taskId, p_code: code, p_lat: lat, p_lng: lng, p_task_passenger_id: riderId }),
      ) as unknown as CheckInResult,
    mock: ({ taskId, code, riderId, lat, lng }) => mockDriverCheckIn(user.id, taskId, code, { lat, lng }, Date.now(), riderId),
    invalidate: () => [taskKeys.all(companyId), ['drivers', companyId]],
  });
}

export function useDropOff() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<{ riderId: string; lat?: number; lng?: number }, { ok: boolean; completed: boolean }>({
    live: async ({ riderId, lat, lng }) =>
      unwrap(await db().rpc('rpc_driver_drop_off', { p_task_passenger_id: riderId, p_lat: lat, p_lng: lng })) as unknown as {
        ok: boolean;
        completed: boolean;
      },
    mock: ({ riderId, lat, lng }) => mockDriverDropOff(user.id, riderId, { lat, lng }),
    invalidate: () => [taskKeys.all(companyId), ['drivers', companyId]],
  });
}
