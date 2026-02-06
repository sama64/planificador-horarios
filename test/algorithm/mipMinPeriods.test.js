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
  const datasetPath = path.resolve(process.cwd(), '..', 'mecatronica-2025C2.json');
  const classes = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const startedAt = performance.now();
  const result = solveWithMipMinPeriods(classes, {
    timeoutMs: 4_900
  });
  const elapsed = performance.now() - startedAt;

  assert.equal(result.success, true);
  assert.equal(validatePlan(classes, result).valid, true);
  assert.equal(result.totalPeriods, 11);
  assert.equal(result.meta.optimality, 'optimal_proven');
  assert.ok(elapsed < 5_000, `mip runtime exceeded 5s: ${elapsed.toFixed(2)}ms`);
});
