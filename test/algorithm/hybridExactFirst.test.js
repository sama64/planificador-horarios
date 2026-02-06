import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { solveWithCriticalPathGreedy } from '../../src/lib/algorithm/solvers/criticalPathGreedy.js';
import { solveWithHybridExactFirst } from '../../src/lib/algorithm/solvers/hybridExactFirst.js';
import { solveWithOracleExact } from '../../src/lib/algorithm/solvers/oracleExact.js';
import { generateRandomCurriculum } from '../../src/lib/algorithm/random.js';
import { validatePlan } from '../../src/lib/algorithm/validate.js';
import { basicFixtureClasses } from './fixtures.js';

test('hybrid solver produces valid optimal-proven plan on basic fixture', () => {
  const classes = basicFixtureClasses();
  const result = solveWithHybridExactFirst(classes, {
    timeoutMs: 2_000,
    minHorizonSliceMs: 20
  });

  assert.equal(result.success, true);
  assert.equal(result.totalPeriods, 3);
  assert.equal(result.meta.optimality, 'optimal_proven');

  const validation = validatePlan(classes, result);
  assert.equal(validation.valid, true);
});

test('hybrid solver matches oracle on small random instances', () => {
  let exactMatches = 0;

  for (let seed = 101; seed <= 120; seed += 1) {
    const classes = generateRandomCurriculum({
      classCount: 11,
      seed,
      prereqProbability: 0.2,
      maxPrereqsPerClass: 2,
      maxOptionsPerClass: 3,
      maxBlocksPerOption: 2
    });

    const oracle = solveWithOracleExact(classes, {
      timeoutMs: 6_000,
      maxClassesForExact: 20
    });

    assert.equal(oracle.success, true, `oracle failed on seed ${seed}`);

    const hybrid = solveWithHybridExactFirst(classes, {
      timeoutMs: 3_000,
      minHorizonSliceMs: 25
    });

    assert.equal(hybrid.success, true, `hybrid failed on seed ${seed}`);
    assert.equal(validatePlan(classes, hybrid).valid, true, `hybrid invalid on seed ${seed}`);

    const gap = hybrid.totalPeriods - oracle.totalPeriods;
    assert.ok(gap >= 0, `hybrid beat oracle unexpectedly on seed ${seed}`);
    assert.ok(gap <= 1, `hybrid gap ${gap} too high on seed ${seed}`);

    if (gap === 0) {
      exactMatches += 1;
    }
  }

  assert.ok(exactMatches >= 19, `hybrid exact matches too low: ${exactMatches}/20`);
});

test('hybrid solver is never worse than greedy on mecatronica dataset', () => {
  const datasetPath = path.resolve(process.cwd(), '..', 'mecatronica-2025C2.json');
  const classes = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const greedy = solveWithCriticalPathGreedy(classes, {
    periodSearchTimeLimitMs: 80
  });

  const hybrid = solveWithHybridExactFirst(classes, {
    timeoutMs: 2_500,
    minHorizonSliceMs: 40
  });

  assert.equal(greedy.success, true);
  assert.equal(hybrid.success, true);

  assert.equal(validatePlan(classes, hybrid).valid, true);
  assert.ok(hybrid.totalPeriods <= greedy.totalPeriods);
});
