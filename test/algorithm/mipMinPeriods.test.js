import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { solveWithMipMinPeriods } from '../../src/lib/algorithm/solvers/mipMinPeriods.js';
import { solveWithOracleExact } from '../../src/lib/algorithm/solvers/oracleExact.js';
import { generateRandomCurriculum } from '../../src/lib/algorithm/random.js';
import { validatePlan } from '../../src/lib/algorithm/validate.js';
import { basicFixtureClasses } from './fixtures.js';

test('mip solver returns valid optimal result on basic fixture', () => {
  const classes = basicFixtureClasses();
  const result = solveWithMipMinPeriods(classes, { timeoutMs: 2_000 });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 3);
  assert.equal(result.meta.optimality, 'optimal_proven');
  assert.equal(validatePlan(classes, result).valid, true);
});

test('mip solver respects max classes per period', () => {
  const classes = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: `C${index + 1}`,
    prerequisites: [],
    scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00` }] }]
  }));

  const result = solveWithMipMinPeriods(classes, {
    timeoutMs: 2_000,
    maxClassesPerPeriod: 6
  });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);
  assert.equal(validatePlan(classes, result, { maxClassesPerPeriod: 6 }).valid, true);
});

test('mip solver rebalances fixed-horizon schedules toward curriculum order', () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    name: `C${index + 1}`,
    prerequisites: index < 4 ? [] : [index - 3],
    scheduleOptions: [{ schedule: [{ day: 'Lunes', startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00` }] }]
  }));

  const result = solveWithMipMinPeriods(classes, {
    timeoutMs: 2_000,
    maxClassesPerPeriod: 4
  });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 2);
  assert.equal(result.meta.balancedScheduleApplied, true);
  assert.deepEqual(
    Object.values(result.assignments)
      .map((assignment) => assignment.period)
      .sort((a, b) => a - b),
    [1, 1, 1, 1, 2, 2, 2, 2]
  );
});

test('mip solver matches oracle on random small instances', () => {
  for (let seed = 201; seed <= 212; seed += 1) {
    const classes = generateRandomCurriculum({
      classCount: 10,
      seed,
      prereqProbability: 0.2,
      maxPrereqsPerClass: 2,
      maxOptionsPerClass: 3,
      maxBlocksPerOption: 2
    });

    const oracle = solveWithOracleExact(classes, {
      timeoutMs: 5_000,
      maxClassesForExact: 20
    });

    assert.equal(oracle.success, true, `oracle failed on seed ${seed}`);

    const mip = solveWithMipMinPeriods(classes, {
      timeoutMs: 3_000
    });

    assert.equal(mip.success, true, `mip failed on seed ${seed}`);
    assert.equal(validatePlan(classes, mip).valid, true, `mip invalid on seed ${seed}`);
    assert.equal(mip.totalPeriods, oracle.totalPeriods, `mip mismatch on seed ${seed}`);
  }
});

test('mip solver proves optimum on mecatronica dataset within 5 seconds', () => {
  const datasetPath = path.resolve(process.cwd(), 'public/curriculums/mecatronica-2026C1.json');
  const classes = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const startedAt = performance.now();
  const result = solveWithMipMinPeriods(classes, {
    timeoutMs: 4_900
  });
  const elapsed = performance.now() - startedAt;

  assert.equal(result.success, true);
  assert.equal(validatePlan(classes, result).valid, true);
  assert.equal(result.totalPeriods, 10);
  assert.equal(result.meta.optimality, 'optimal_proven');
  assert.ok(elapsed < 5_000, `mip runtime exceeded 5s: ${elapsed.toFixed(2)}ms`);
});
