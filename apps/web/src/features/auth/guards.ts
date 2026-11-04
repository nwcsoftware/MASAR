import { redirect, type ParsedLocation } from '@tanstack/react-router';
import type { Session, SessionUser } from './session';
import { STAFF_ROLES, type AppRole } from '@/lib/task-meta';

export interface RouterContext {
  session: Session;
}

export type HomePath = '/platform' | '/no-company' | '/driver' | '/passenger' | '/dashboard';

/**
 * Where a signed-in user lands: the super admin → companies console (0008),
 * an account not attached to any company yet → waiting screen (only the super
 * admin creates companies), drivers → PWA, passengers → their app.
 */
export function homePathFor(user: SessionUser): HomePath {
  if (user.isPlatformAdmin) return '/platform';
  if (!user.profile.company_id) return '/no-company';
  if (user.profile.role === 'driver') return '/driver';
  if (user.profile.role === 'passenger') return '/passenger';
  return '/dashboard';
}

function requireSignedIn(session: Session, location: ParsedLocation): SessionUser {
  if (session.status !== 'signed-in') {
    throw redirect({ to: '/login', search: { redirect: location.href } });
  }
  return session.user;
}

/** (admin) group: owner, admin, dispatcher and viewer. Drivers go to their app. */
export function requireConsoleUser(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.profile.role === 'driver') throw redirect({ to: '/driver' });
  if (user.profile.role === 'passenger') throw redirect({ to: '/passenger' });
  if (user.isPlatformAdmin || !user.profile.company_id) throw redirect({ to: homePathFor(user) });
  return user;
}

/** /platform: the super admin only (0008). */
export function requirePlatformAdmin(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (!user.isPlatformAdmin) throw redirect({ to: homePathFor(user) });
  return user;
}

/** /no-company: signed in but not attached to a company (and not the super admin). */
export function requireNoCompanyUser(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.isPlatformAdmin || user.profile.company_id) throw redirect({ to: homePathFor(user) });
  return user;
}

/** (passenger) group: passengers only (0006). Pending/rejected see a status screen, not trips. */
export function requirePassenger(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.profile.role !== 'passenger' || !user.profile.company_id) throw redirect({ to: homePathFor(user) });
  return user;
}

/** (driver) group: drivers only. */
export function requireDriver(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.profile.role !== 'driver' || !user.profile.company_id) throw redirect({ to: homePathFor(user) });
  return user;
}

/**
 * Onboarding: the owner (or an admin) of a company the super admin created —
 * confirm the profile, add sites and airports, invite people (0008). Users
 * without a company can no longer create one here.
 */
export function requireOnboardingUser(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  const canOnboard = Boolean(user.profile.company_id) && (user.profile.role === 'owner' || user.profile.role === 'admin');
  if (!canOnboard) throw redirect({ to: homePathFor(user) });
  return user;
}

/** (auth) group: bounce signed-in users to their home. */
export function redirectIfSignedIn(session: Session, redirectTo?: string) {
  if (session.status === 'signed-in') {
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) throw redirect({ href: redirectTo });
    throw redirect({ to: homePathFor(session.user) });
  }
}

export const isStaff = (role: AppRole) => STAFF_ROLES.includes(role);
export const isAdmin = (role: AppRole) => role === 'owner' || role === 'admin';
