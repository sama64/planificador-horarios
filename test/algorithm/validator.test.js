import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePlan } from '../../src/lib/algorithm/validate.js';
import { basicFixtureClasses } from './fixtures.js';

test('validatePlan accepts a valid schedule', () => {
  const classes = basicFixtureClasses();
  const plan = {
    assignments: {
      1: { period: 1, optionIndex: 0 },
      3: { period: 1, optionIndex: 1 },
      2: { period: 2, optionIndex: 1 },
      4: { period: 3, optionIndex: 0 }
    },
    totalPeriods: 3
  };

  const result = validatePlan(classes, plan);
  assert.equal(result.valid, true);
  assert.equal(result.violations.length, 0);
});

test('validatePlan flags prerequisite ordering violations', () => {
  const classes = basicFixtureClasses();
  const plan = {
    assignments: {
      1: { period: 2, optionIndex: 0 },
      3: { period: 1, optionIndex: 1 },
      2: { period: 1, optionIndex: 1 },
      4: { period: 3, optionIndex: 0 }
    },
    totalPeriods: 3
  };

  const result = validatePlan(classes, plan);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.type === 'PREREQUISITE_ORDER'));
});

test('validatePlan flags time conflicts in the same period', () => {
  const classes = basicFixtureClasses();
  const plan = {
    assignments: {
      1: { period: 1, optionIndex: 0 },
      3: { period: 1, optionIndex: 0 },
      2: { period: 2, optionIndex: 1 },
      4: { period: 3, optionIndex: 0 }
    },
    totalPeriods: 3
  };

  const result = validatePlan(classes, plan);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.type === 'TIME_CONFLICT'));
});

test('validatePlan flags invalid options and missing classes', () => {
  const classes = basicFixtureClasses();
  const plan = {
    assignments: {
      1: { period: 1, optionIndex: 5 },
      2: { period: 2, optionIndex: 0 },
      3: { period: 1, optionIndex: 1 }
    },
    totalPeriods: 2
  };

  const result = validatePlan(classes, plan);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.type === 'INVALID_OPTION'));
  assert.ok(result.violations.some((violation) => violation.type === 'MISSING_CLASS'));
});

test('validatePlan checks total period consistency', () => {
  const classes = basicFixtureClasses();
  const plan = {
    assignments: {
      1: { period: 1, optionIndex: 0 },
      3: { period: 1, optionIndex: 1 },
      2: { period: 2, optionIndex: 1 },
      4: { period: 3, optionIndex: 0 }
    },
    totalPeriods: 4
  };

  const result = validatePlan(classes, plan);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.type === 'PERIOD_COUNT_MISMATCH'));
});
