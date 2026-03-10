import test from 'node:test';
import assert from 'node:assert/strict';

import { solveScheduleWithConstraints } from '../../src/lib/algorithm/entrypoint.js';
import { validatePlan } from '../../src/lib/algorithm/validate.js';

function dayPreferenceFixture() {
  return [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [
        { schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }] },
        { schedule: [{ day: 'Martes', startTime: '08:00', endTime: '10:00' }] }
      ]
    },
    {
      id: 2,
      name: 'B',
      prerequisites: [1],
      scheduleOptions: [{ schedule: [{ day: 'Miercoles', startTime: '08:00', endTime: '10:00' }] }]
    }
  ];
}

test('entrypoint applies forbidden day hard filter and remaps option index', () => {
  const classes = dayPreferenceFixture();

  const result = solveScheduleWithConstraints(classes, {
    forbiddenDays: ['Lunes']
  });

  assert.equal(result.success, true);
  assert.equal(result.assignments[1].optionIndex, 1);
  assert.equal(result.totalPeriods, 2);
  assert.equal(validatePlan(classes, result).valid, true);
});

test('entrypoint applies soft time preference through mip penalties', () => {
  const classes = [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [
        { schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }] },
        { schedule: [{ day: 'Lunes', startTime: '14:00', endTime: '16:00' }] }
      ]
    }
  ];

  const result = solveScheduleWithConstraints(classes, {
    timePreference: 'afternoon',
    timePreferenceMode: 'soft'
  });

  assert.equal(result.success, true);
  assert.equal(result.assignments[1].optionIndex, 1);
  assert.equal(validatePlan(classes, result).valid, true);
});

test('entrypoint enforces max weekly hours per period', () => {
  const classes = [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '12:00' }] }]
    },
    {
      id: 2,
      name: 'B',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Martes', startTime: '08:00', endTime: '12:00' }] }]
    }
  ];

  const unconstrained = solveScheduleWithConstraints(classes, {});
  const constrained = solveScheduleWithConstraints(classes, {
    maxWeeklyHoursPerPeriod: 4
  });

  assert.equal(unconstrained.success, true);
  assert.equal(constrained.success, true);
  assert.equal(unconstrained.totalPeriods, 1);
  assert.equal(constrained.totalPeriods, 2);
  assert.equal(validatePlan(classes, constrained).valid, true);
});

test('entrypoint defaults to 6 classes per period when no cap is provided', () => {
  const classes = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: `C${index + 1}`,
    prerequisites: [],
    scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00` }] }]
  }));

  const result = solveScheduleWithConstraints(classes, {});

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);
  assert.equal(validatePlan(classes, result, { maxClassesPerPeriod: 6 }).valid, true);
});

test('entrypoint balances curriculum order after minimizing total periods', () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    name: `C${index + 1}`,
    prerequisites: index < 4 ? [] : [index - 3],
    scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00` }] }]
  }));

  const result = solveScheduleWithConstraints(classes, {
    maxClassesPerPeriod: 4
  });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);
  assert.deepEqual(
    Object.entries(result.scheduleByPeriod)
      .map(([period, entries]) => [Number(period), entries.map((entry) => entry.classId)])
      .sort((a, b) => a[0] - b[0]),
    [
      [1, [1, 2, 3, 4]],
      [2, [5, 6, 7, 8]]
    ]
  );
});

test('entrypoint handles passed classes and prerequisite reduction', () => {
  const classes = [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }] }]
    },
    {
      id: 2,
      name: 'B',
      prerequisites: [1],
      scheduleOptions: [{ schedule: [{ day: 'Martes', startTime: '08:00', endTime: '10:00' }] }]
    }
  ];

  const result = solveScheduleWithConstraints(classes, {
    passedClassIds: [1]
  });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 1);
  assert.ok(!result.assignments[1]);
  assert.equal(result.assignments[2].period, 1);

  const activeClasses = [
    {
      ...classes[1],
      prerequisites: []
    }
  ];
  assert.equal(validatePlan(activeClasses, { assignments: { 2: result.assignments[2] }, totalPeriods: 1 }).valid, true);
});

test('entrypoint fails when hard constraints remove all options from a class', () => {
  const classes = [
    {
      id: 1,
      name: 'A',
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }] }]
    }
  ];

  const result = solveScheduleWithConstraints(classes, {
    forbiddenDays: ['Lunes']
  });

  assert.equal(result.success, false);
  assert.ok(result.meta.unschedulableClasses.some((entry) => entry.classId === 1));
});
