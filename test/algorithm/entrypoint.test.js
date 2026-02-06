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
