import { createFileRoute, redirect } from '@tanstack/react-router';
import { homePathFor } from '@/features/auth/guards';

/** Role-based landing: drivers → /driver, staff → /dashboard, signed out → /login. */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.session.status !== 'signed-in') throw redirect({ to: '/login' });
    throw redirect({ to: homePathFor(context.session.user) });
  },
});
