import { describe, expect, it } from 'vitest';
import { distanceKm, estimateDrive, isValidLatLng } from '@/lib/geo';
import { toCsv } from '@/lib/csv';
import { canReportDelay, primaryDriverAction, statusColorVar } from '@/lib/task-meta';

describe('geo', () => {
  it('matches fn_distance_km (haversine) for Riyadh HQ → RUH', () => {
    // seed.sql: site_airports distance = haversine × 1.3 ≈ 39.6 km for RHQ–RUH
    const km = distanceKm(24.6948, 46.6857, 24.9576, 46.6988);
    expect(km).toBeCloseTo(29.25, 1);
    expect(estimateDrive(km)).toEqual({ roadKm: 38, minutes: 33 });
  });

  it('validates coordinates (US-01)', () => {
    expect(isValidLatLng(24.7, 46.7)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines and prefixes a BOM for Excel', () => {
    const csv = toCsv([
      ['name', 'note'],
      ['أحمد', 'said "hi", left'],
      [null, 3],
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['name,note', 'أحمد,"said ""hi"", left"', ',3']);
  });
});

describe('task-meta', () => {
  it('maps each status to the driver’s next primary action (FR-30)', () => {
    expect(primaryDriverAction('assigned')).toBe('acknowledge');
    expect(primaryDriverAction('acknowledged')).toBe('start');
    expect(primaryDriverAction('en_route')).toBe('arrive');
    expect(primaryDriverAction('in_progress')).toBe('complete');
    expect(primaryDriverAction('completed')).toBeNull();
    expect(primaryDriverAction('scheduled')).toBeNull();
  });

  it('skips ahead from delayed to the step after the pre-delay status', () => {
    expect(primaryDriverAction('delayed', 'en_route')).toBe('arrive');
    expect(primaryDriverAction('delayed', 'in_progress')).toBe('complete');
    expect(primaryDriverAction('delayed', 'acknowledged')).toBe('start');
  });

  it('only allows a delay report from live, non-delayed statuses', () => {
    expect(canReportDelay('en_route')).toBe(true);
    expect(canReportDelay('delayed')).toBe(false);
    expect(canReportDelay('completed')).toBe(false);
  });

  it('maps DB statuses onto tokens.css names', () => {
    expect(statusColorVar('en_route')).toBe('var(--status-en-route)');
    expect(statusColorVar('no_show')).toBe('var(--status-no-show)');
    expect(statusColorVar('declined')).toBe('var(--status-no-show)');
  });
});
