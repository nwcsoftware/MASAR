import type { Json } from '@/lib/database.types';
import type { GradeGroup, Person, TaskConflict } from '@/mocks/fixtures';

/**
 * Company grade rules (migration 0004), shared by the wizard preview, the
 * demo-mode store and the UI badges. Mirrors fn_snapshot_passengers and
 * fn_grade_conflicts — keep them in sync.
 *
 *  - one group per car, and it must be the car's group;
 *  - a driver's "drives for" group is the most senior group they may carry
 *    (A = everyone; C = C and below). Rank 1 = A = most senior.
 */

/** A passenger as stored in tasks.passengers (snapshot at save time). */
export interface Passenger {
  person_id?: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  grade?: number | null;
  group_id?: string | null;
  group_code?: string | null;
  /** one-time visitor: not in the directory, given a group for the trip */
  visitor?: boolean;
}

export type GradeConflict = Pick<TaskConflict, 'type' | 'severity' | 'details'> & { other_task_id: null };

export function groupForGrade(groups: GradeGroup[], grade: number | null | undefined): GradeGroup | null {
  if (grade == null) return null;
  return [...groups].sort((a, b) => a.rank - b.rank).find((g) => grade >= g.min_grade && grade <= g.max_grade) ?? null;
}

export function readPassengers(value: Json | null | undefined): Passenger[] {
  return (Array.isArray(value) ? value : []).filter((p): p is Passenger & Json => typeof p === 'object' && p !== null && !Array.isArray(p)) as Passenger[];
}

/**
 * fn_snapshot_passengers: registered people take their directory grade and
 * group; visitors keep the group they were given; free text stays ungraded
 * (a client can never claim a group for it).
 */
export function snapshotPassengers(input: Passenger[], people: Person[], groups: GradeGroup[]): Passenger[] {
  return input.map((p) => {
    const strip = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')) as T;
    if (p.person_id) {
      const person = people.find((x) => x.id === p.person_id);
      if (!person) throw new Error('errors.invalidInput');
      const group = groupForGrade(groups, person.grade);
      return strip({
        person_id: person.id,
        name: p.name?.trim() || person.full_name,
        phone: p.phone?.trim() || person.phone,
        note: p.note,
        grade: person.grade,
        group_id: group?.id,
        group_code: group?.code,
      });
    }
    if (p.visitor) {
      const group = groups.find((g) => g.id === p.group_id) ?? null;
      return strip({ name: p.name.trim(), phone: p.phone?.trim(), note: p.note, visitor: true, group_id: group?.id, group_code: group?.code });
    }
    return strip({ name: p.name.trim(), phone: p.phone?.trim(), note: p.note });
  });
}

/** Distinct groups on board, most senior first (current definitions). */
export function groupsOnBoard(passengers: Passenger[], groups: GradeGroup[]): GradeGroup[] {
  const ids = new Set(passengers.map((p) => p.group_id).filter(Boolean));
  return groups.filter((g) => ids.has(g.id)).sort((a, b) => a.rank - b.rank);
}

/** fn_grade_conflicts */
export function gradeConflicts(input: {
  passengers: Passenger[];
  groups: GradeGroup[];
  vehicleGroupId?: string | null;
  serveGroupId?: string | null;
}): GradeConflict[] {
  const onBoard = groupsOnBoard(input.passengers, input.groups);
  if (!onBoard.length) return [];
  const codes = onBoard.map((g) => g.code);
  const out: GradeConflict[] = [];
  if (onBoard.length > 1) out.push({ type: 'grade_mixed', severity: 'blocking', other_task_id: null, details: { groups: codes } });
  const vehicle = input.groups.find((g) => g.id === input.vehicleGroupId);
  if (vehicle && (codes.length !== 1 || codes[0] !== vehicle.code)) {
    out.push({ type: 'vehicle_grade_mismatch', severity: 'blocking', other_task_id: null, details: { vehicle_group: vehicle.code, groups: codes } });
  }
  const serve = input.groups.find((g) => g.id === input.serveGroupId);
  if (serve && onBoard[0]!.rank < serve.rank) {
    out.push({ type: 'driver_grade_not_allowed', severity: 'blocking', other_task_id: null, details: { serve_group: serve.code, group: onBoard[0]!.code } });
  }
  return out;
}

/** Whether a rider's passengers may join a trip (FR-15 within one group). */
export function canShareWith(riderCodes: string[], trip: { passenger_groups?: string[] | null; vehicle_group?: string | null }): boolean {
  const all = new Set([...riderCodes, ...(trip.passenger_groups ?? [])]);
  if (all.size > 1) return false;
  const [only] = [...all];
  return !only || !trip.vehicle_group || trip.vehicle_group === only;
}

/** "20 is most senior" or "01 is most senior": four groups of five over 1–20. */
export function presetGroups(seniorEnd: 'high' | 'low'): { code: string; name: string; name_ar: string; min_grade: number; max_grade: number }[] {
  const names = [
    ['A', 'Executives', 'الإدارة العليا'],
    ['B', 'Managers', 'المدراء'],
    ['C', 'Staff', 'الموظفون'],
    ['D', 'Support', 'الدعم'],
  ] as const;
  return names.map(([code, name, name_ar], i) =>
    seniorEnd === 'high'
      ? { code, name, name_ar, min_grade: 16 - i * 5, max_grade: 20 - i * 5 }
      : { code, name, name_ar, min_grade: 1 + i * 5, max_grade: 5 + i * 5 },
  );
}
