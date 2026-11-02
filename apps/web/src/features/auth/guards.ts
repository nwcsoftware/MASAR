import { redirect, type ParsedLocation } from '@tanstack/react-router';
import type { Session, SessionUser } from './session';
import { STAFF_ROLES, type AppRole } from '@/lib/task-meta';

export interface RouterContext {
  session: Session;
}

/** Where a signed-in user lands: drivers → PWA, owners without a company → onboarding. */
export function homePathFor(user: SessionUser): '/driver' | '/onboarding' | '/dashboard' {
  if (user.profile.role === 'driver') return '/driver';
  if (!user.profile.company_id) return '/onboarding';
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
  if (!user.profile.company_id) throw redirect({ to: '/onboarding' });
  return user;
}

/** (driver) group: drivers only. */
export function requireDriver(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.profile.role !== 'driver') throw redirect({ to: homePathFor(user) });
  return user;
}

/** Onboarding: signed-in owners/admins. */
export function requireOnboardingUser(session: Session, location: ParsedLocation): SessionUser {
  const user = requireSignedIn(session, location);
  if (user.profile.role !== 'owner' && user.profile.role !== 'admin') throw redirect({ to: homePathFor(user) });
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
