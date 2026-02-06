import test from 'node:test';
import assert from 'node:assert/strict';

import { solveWithOracleExact } from '../../src/lib/algorithm/solvers/oracleExact.js';
import { validatePlan } from '../../src/lib/algorithm/validate.js';
import { basicFixtureClasses, conflictingNoPrereqFixture } from './fixtures.js';

test('oracle solver finds optimal schedule on basic fixture', () => {
  const classes = basicFixtureClasses();
  const result = solveWithOracleExact(classes, { timeoutMs: 2_000, maxClassesForExact: 20 });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 3);

  const validation = validatePlan(classes, result);
  assert.equal(validation.valid, true);
});

test('oracle solver handles pure conflict packing', () => {
  const classes = conflictingNoPrereqFixture();
  const result = solveWithOracleExact(classes, { timeoutMs: 2_000, maxClassesForExact: 20 });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);

  const validation = validatePlan(classes, result);
  assert.equal(validation.valid, true);
});

test('oracle solver exploits schedule options to reduce periods', () => {
  const classes = [
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
      prerequisites: [],
      scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: '09:00', endTime: '11:00' }] }]
    },
    {
      id: 3,
      name: 'C',
      prerequisites: [1],
      scheduleOptions: [{ schedule: [{ day: 'Miercoles', startTime: '08:00', endTime: '10:00' }] }]
    }
  ];

  const result = solveWithOracleExact(classes, { timeoutMs: 2_000, maxClassesForExact: 20 });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);

  const validation = validatePlan(classes, result);
  assert.equal(validation.valid, true);
});
