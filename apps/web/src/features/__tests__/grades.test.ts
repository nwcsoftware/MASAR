import { describe, expect, it } from 'vitest';
import { canShareWith, gradeConflicts, groupForGrade, presetGroups, snapshotPassengers } from '@/features/grades/rules';
import { gradeGroupsSchema } from '@/features/grades/schema';
import { guessMapping, mapRows, parseCsv } from '@/features/people/import';
import type { SaveTaskPayload } from '@/features/tasks/types';
import { mockDb } from '@/mocks/db';
import { at, IDS } from '@/mocks/fixtures';
import { mockSaveTask, mockShareTrip, type MockActor } from '@/mocks/task-writes';

const G = IDS.groups;
const P = IDS.people;
const groups = () => mockDb.gradeGroups;
const owner: MockActor = { id: IDS.users.owner, role: 'owner', siteIds: [] };
const dispatcher: MockActor = { id: IDS.users.dispatcher, role: 'dispatcher', siteIds: [IDS.sites.rhq, IDS.sites.yasmin] };

function trip(title: string, passengers: SaveTaskPayload['passengers'], driverId: string | null = null, vehicleId: string | null = null, reason: string | null = null): SaveTaskPayload {
  return {
    site_id: IDS.sites.rhq,
    category: 'escort',
    priority: 'normal',
    title,
    description: null,
    scheduled_start: at(3, '10:00'),
    scheduled_end: at(3, '11:00'),
    estimated_duration_min: 60,
    estimated_distance_km: null,
    passengers,
    metadata: {},
    stops: [
      { label: 'Riyadh HQ', address: null, lat: 24.6948, lng: 46.6857, site_id: null, airport_id: null, planned_arrival_at: null, dwell_min: 0, leg_distance_km: null, leg_duration_min: null, contact_name: null, contact_phone: null },
      { label: 'Bank', address: null, lat: 24.711, lng: 46.6745, site_id: null, airport_id: null, planned_arrival_at: null, dwell_min: 0, leg_distance_km: null, leg_duration_min: null, contact_name: null, contact_phone: null },
    ],
    flight: null,
    driver_id: driverId,
    vehicle_id: vehicleId,
    override_reason: reason,
    share_with_task_id: null,
  };
}

describe('grade groups (0004)', () => {
  it('maps grades to groups; presets follow the senior end the company picks', () => {
    expect(groupForGrade(groups(), 19)?.code).toBe('A');
    expect(groupForGrade(groups(), 6)?.code).toBe('C');
    expect(groupForGrade(groups(), null)).toBeNull();
    expect(presetGroups('high')[0]).toMatchObject({ code: 'A', min_grade: 16, max_grade: 20 });
    expect(presetGroups('low')[0]).toMatchObject({ code: 'A', min_grade: 1, max_grade: 5 });
  });

  it('rejects overlapping ranges and duplicate letters', () => {
    const issues = (g: object[]) => gradeGroupsSchema.safeParse({ groups: g }).error?.issues.map((i) => i.message) ?? [];
    expect(issues(presetGroups('high'))).toEqual([]);
    expect(issues([{ code: 'A', min_grade: 11, max_grade: 20 }, { code: 'B', min_grade: 1, max_grade: 12 }])).toEqual(['grades.errors.overlap']);
    expect(issues([{ code: 'A', min_grade: 1, max_grade: 5 }, { code: 'a', min_grade: 6, max_grade: 9 }])).toEqual(['grades.errors.duplicateCode']);
    expect(issues([{ code: 'A', min_grade: 9, max_grade: 3 }])).toEqual(['grades.errors.range']);
  });

  it('snapshots passengers from the directory; free text cannot claim a group', () => {
    const [saad, visitor, spoof] = snapshotPassengers(
      [{ person_id: P.saad, name: '', grade: 1 }, { name: 'Guest', visitor: true, group_id: G.D }, { name: 'Spoof', group_id: G.A, grade: 20 }],
      mockDb.people,
      groups(),
    );
    expect(saad).toMatchObject({ name: 'Mr. Saad Al-Ghamdi', grade: 19, group_code: 'A' });
    expect(visitor).toMatchObject({ visitor: true, group_code: 'D' });
    expect(spoof).toEqual({ name: 'Spoof' });
    expect(() => snapshotPassengers([{ person_id: 'nobody', name: 'x' }], mockDb.people, groups())).toThrow();
  });

  it('same group only: mixed groups, the car’s group, the driver’s reach', () => {
    const on = (ids: string[]) => snapshotPassengers(ids.map((person_id) => ({ person_id, name: '' })), mockDb.people, groups());
    const types = (c: { type: string }[]) => c.map((x) => x.type);
    expect(types(gradeConflicts({ passengers: on([P.saad, P.noura]), groups: groups() }))).toEqual(['grade_mixed']);
    expect(types(gradeConflicts({ passengers: on([P.sara]), groups: groups(), vehicleGroupId: G.C }))).toEqual(['vehicle_grade_mismatch']);
    // Fahad drives for B: B and below, not A
    expect(types(gradeConflicts({ passengers: on([P.tariq]), groups: groups(), serveGroupId: G.B }))).toEqual(['driver_grade_not_allowed']);
    expect(gradeConflicts({ passengers: on([P.noura]), groups: groups(), serveGroupId: G.B, vehicleGroupId: G.C })).toEqual([]);
    expect(gradeConflicts({ passengers: on([P.sara]), groups: [], vehicleGroupId: G.C })).toEqual([]);
  });

  it('shares only into a car of the same group', () => {
    expect(canShareWith(['B'], { passenger_groups: ['B'], vehicle_group: 'B' })).toBe(true);
    expect(canShareWith(['A'], { passenger_groups: ['B'], vehicle_group: 'B' })).toBe(false);
    expect(canShareWith(['C'], { passenger_groups: [], vehicle_group: 'B' })).toBe(false);
    expect(canShareWith([], { passenger_groups: [], vehicle_group: null })).toBe(true);
  });
});

describe('staff import (Excel / CSV)', () => {
  it('parses CSV with a BOM, quotes and semicolons', () => {
    expect(parseCsv('\uFEFFName,Grade\r\n"Al-Otaibi, Sara",14\r\n')).toEqual([['Name', 'Grade'], ['Al-Otaibi, Sara', '14']]);
    expect(parseCsv('Name;Grade\nNoura;7\n')).toEqual([['Name', 'Grade'], ['Noura', '7']]);
  });

  it('matches English and Arabic headers and validates rows', () => {
    const cells = [
      ['الرقم الوظيفي', 'Name', 'الدرجة', 'Site', 'Notes'],
      ['E-2001', 'Eng. Laila Hassan', '14', 'RHQ', 'x'],
      ['E-2002', '', '9', '', ''],
      ['E-2003', 'Omar', 'G-120', '', ''],
    ];
    const mapping = guessMapping(cells[0]!);
    expect(mapping).toEqual({ employee_no: 0, full_name: 1, grade: 2, site: 3 });
    const rows = mapRows(cells, mapping);
    expect(rows[0]).toMatchObject({ line: 2, row: { employee_no: 'E-2001', full_name: 'Eng. Laila Hassan', grade: 14, site: 'RHQ' } });
    expect(rows[1]!.errors).toEqual(['people.errors.name']);
    expect(rows[2]!.errors).toEqual(['people.errors.grade']);
  });
});

describe('demo mirror: grade gate (keep in sync with supabase/tests/0004_grades.test.sql)', () => {
  it('seed: tomorrow’s finance escort mixes A and C', () => {
    expect(mockDb.taskConflicts.some((c) => c.task_id === IDS.tasks[12] && c.type === 'grade_mixed' && !c.resolved_at)).toBe(true);
  });

  it('a mixed-grade trip is blocked; an owner overrides and the stored grade comes from the directory', () => {
    const passengers = [{ person_id: P.saad, name: '', grade: 1 }, { person_id: P.noura, name: '' }];
    expect(() => mockSaveTask(trip('G-mixed', passengers), dispatcher)).toThrow('conflicts.errors.blocking');
    expect(() => mockSaveTask(trip('G-mixed', passengers, null, null, 'CEO'), dispatcher)).toThrow('conflicts.errors.adminOnly');
    const id = mockSaveTask(trip('G-mixed', passengers, null, null, 'CEO request'), owner);
    const task = mockDb.tasks.find((t) => t.id === id)!;
    expect(task.passengers).toEqual(expect.arrayContaining([expect.objectContaining({ person_id: P.saad, grade: 19, group_code: 'A' })]));
    expect(mockDb.taskConflicts.some((c) => c.task_id === id && c.type === 'grade_mixed' && !c.resolved_at)).toBe(true);
  });

  it('a B passenger in the C group Hiace, or with a driver who drives for C, is blocked', () => {
    expect(() => mockSaveTask(trip('G-car', [{ person_id: P.sara, name: '' }], IDS.drivers.ahmed, IDS.vehicles.hiace), dispatcher)).toThrow('conflicts.errors.blocking');
    expect(() => mockSaveTask(trip('G-driver', [{ person_id: P.sara, name: '' }], IDS.drivers.khalid), dispatcher)).toThrow('conflicts.errors.blocking');
    expect(mockSaveTask(trip('G-ok', [{ person_id: P.sara, name: '' }], IDS.drivers.ahmed, IDS.vehicles.camry), dispatcher)).toBeTruthy();
  });

  it('an A passenger cannot join the B airport trip', () => {
    const rider = mockDb.tasks.find((t) => t.id === IDS.tasks[10])!;
    rider.passengers = snapshotPassengers([{ person_id: P.saad, name: '' }], mockDb.people, groups()) as unknown as typeof rider.passengers;
    expect(() => mockShareTrip(IDS.tasks[10]!, IDS.tasks[2]!, dispatcher)).toThrow('share.errors.gradeMismatch');
  });
});
