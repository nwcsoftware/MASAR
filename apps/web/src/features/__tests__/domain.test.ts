import { describe, expect, it } from 'vitest';
import { deriveAttention } from '@/features/dashboard/attention';
import { selectMockTasks } from '@/features/tasks/queries';
import { aggregateHours } from '@/features/reports/queries';
import { homePathFor } from '@/features/auth/guards';
import type { SessionUser } from '@/features/auth/session';
import { companyRulesSchema } from '@/features/company/schema';
import { siteStepSchema } from '@/features/onboarding/schema';
import { licenceExpiresSoon } from '@/features/drivers/utils';
import * as fx from '@/mocks/fixtures';

describe('selectMockTasks', () => {
  const today = { from: fx.at(0, '00:00'), to: fx.at(1, '00:00') };

  it('filters by day, site, driver and search like the real query will', () => {
    expect(selectMockTasks(today)).toHaveLength(10);
    expect(selectMockTasks({ ...today, siteIds: [fx.IDS.sites.jeddah] }).map((t) => t.title)).toEqual([
      'Escort · Al Rajhi Bank',
      'JED departure · XY 210',
    ]);
    expect(selectMockTasks({ ...today, driverId: fx.IDS.drivers.ahmed })).toHaveLength(3);
    expect(selectMockTasks({ search: 'sv 1234' }).map((t) => t.id)).toEqual([fx.IDS.tasks[2]]);
  });

  it('joins open conflicts onto both sides of a double booking', () => {
    const jeddah = selectMockTasks({ ...today, siteIds: [fx.IDS.sites.jeddah] });
    for (const task of jeddah) expect(task.conflicts.some((c) => c.type === 'driver_overlap' && c.severity === 'blocking')).toBe(true);
  });
});

describe('deriveAttention (FR-43)', () => {
  const tasks = selectMockTasks({ from: fx.at(0, '00:00'), to: fx.at(2, '00:00') });
  const items = deriveAttention(tasks, { now: new Date(fx.at(0, '12:00')) });

  it('lists one double booking per overlapping pair, first', () => {
    expect(items[0]?.kind).toBe('double_booked');
    expect(items.filter((i) => i.kind === 'double_booked')).toHaveLength(1);
  });

  it('includes the delayed SV 1234 pickup, Khalid’s unacknowledged trip, Yousef over hours and the unassigned EK 817', () => {
    const kinds = items.map((i) => `${i.kind}:${i.task.title}`);
    expect(kinds).toContain('delayed:Pick up Eng. Sara Al-Otaibi');
    expect(kinds).toContain('not_acknowledged:DMM arrival · MS 691');
    expect(items.filter((i) => i.kind === 'over_hours')).toHaveLength(1);
    expect(kinds).toContain('unassigned:Pick up consultant — EK 817');
  });

  it('reports minutes left before the acknowledge deadline', () => {
    const ack = (title: string) => items.find((i) => i.kind === 'not_acknowledged' && i.task.title === title);
    // Khalid starts 14:20, deadline 120 min earlier = 12:20 → 20 min after 12:00
    expect(ack('DMM arrival · MS 691')?.deadlineInMin).toBe(20);
    // Yousef starts 12:30 → deadline 10:30 passed 90 min ago
    expect(ack('JED departure · XY 210')?.deadlineInMin).toBe(-90);
  });
});

describe('aggregateHours (US-10)', () => {
  it('sums day summaries per driver and overall', () => {
    const report = aggregateHours(fx.driverDaySummaries, fx.drivers, fx.sites);
    const sum = fx.driverDaySummaries.reduce((n, s) => n + s.driving_min, 0);
    expect(report.totals.drivingMin).toBe(sum);
    expect(report.rows).toHaveLength(4);
    expect(report.rows.reduce((n, r) => n + r.overtimeMin, 0)).toBe(report.totals.overtimeMin);
  });
});

describe('homePathFor (role-based redirect)', () => {
  const user = (role: SessionUser['profile']['role'], companyId: string | null = fx.COMPANY_ID): SessionUser => ({
    id: 'u',
    email: null,
    profile: { ...fx.profiles[0]!, role, company_id: companyId },
    company: fx.company,
    driverId: null,
    siteIds: [],
  });

  it('sends drivers to the PWA, staff to the dashboard and new owners to onboarding', () => {
    expect(homePathFor(user('driver'))).toBe('/driver');
    expect(homePathFor(user('dispatcher'))).toBe('/dashboard');
    expect(homePathFor(user('viewer'))).toBe('/dashboard');
    expect(homePathFor(user('owner', null))).toBe('/onboarding');
  });
});

describe('schemas', () => {
  it('rejects out-of-range site coordinates (US-01)', () => {
    const base = { name: 'Site', type: 'office' as const, lat: 24.7, lng: 46.7 };
    expect(siteStepSchema.safeParse(base).success).toBe(true);
    const bad = siteStepSchema.safeParse({ ...base, lat: 95 });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('onboarding.errors.lat');
  });

  it('requires no-show to come after the not-started alert', () => {
    const rules = { ...fx.companySettings, far_location_km: 50 };
    expect(companyRulesSchema.safeParse(rules).success).toBe(true);
    const bad = companyRulesSchema.safeParse({ ...rules, no_show_after_min: 10, grace_min: 15 });
    expect(bad.error?.issues.map((i) => i.message)).toContain('settings.errors.noShowAfterGrace');
  });
});

describe('licenceExpiresSoon', () => {
  it('flags licences within 60 days', () => {
    const now = new Date('2026-11-02T00:00:00Z');
    expect(licenceExpiresSoon('2026-12-01', 60, now)).toBe(true);
    expect(licenceExpiresSoon('2027-06-01', 60, now)).toBe(false);
    expect(licenceExpiresSoon(null, 60, now)).toBe(false);
  });
});
