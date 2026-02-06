import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { solveWithCriticalPathGreedy } from '../../src/lib/algorithm/solvers/criticalPathGreedy.js';
import { solveWithOracleExact } from '../../src/lib/algorithm/solvers/oracleExact.js';
import { generateRandomCurriculum } from '../../src/lib/algorithm/random.js';
import { validatePlan } from '../../src/lib/algorithm/validate.js';

test('critical-path greedy produces valid schedules near oracle on random small cases', () => {
  let worstGap = 0;
  let exactMatches = 0;

  for (let seed = 1; seed <= 30; seed += 1) {
    const classes = generateRandomCurriculum({
      classCount: 10,
      seed,
      prereqProbability: 0.2,
      maxPrereqsPerClass: 2,
      maxOptionsPerClass: 3,
      maxBlocksPerOption: 2
    });

    const oracle = solveWithOracleExact(classes, {
      timeoutMs: 4_000,
      maxClassesForExact: 20
    });

    assert.equal(oracle.success, true, `oracle failed on seed ${seed}`);
    assert.equal(validatePlan(classes, oracle).valid, true, `oracle invalid on seed ${seed}`);

    const candidate = solveWithCriticalPathGreedy(classes, {
      periodSearchTimeLimitMs: 50
    });

    assert.equal(candidate.success, true, `candidate failed on seed ${seed}`);
    assert.equal(validatePlan(classes, candidate).valid, true, `candidate invalid on seed ${seed}`);

    const gap = candidate.totalPeriods - oracle.totalPeriods;
    worstGap = Math.max(worstGap, gap);

    if (gap === 0) {
      exactMatches += 1;
    }

    assert.ok(gap >= 0, `candidate beat oracle unexpectedly on seed ${seed}`);
    assert.ok(gap <= 3, `candidate gap too large (${gap}) on seed ${seed}`);
  }

  assert.ok(exactMatches >= 10, `candidate exact matches too low: ${exactMatches}/30`);
  assert.ok(worstGap <= 3, `worst gap too high: ${worstGap}`);
});

test('critical-path greedy handles mecatronica dataset and returns valid output', () => {
  const datasetPath = path.resolve(process.cwd(), '..', 'mecatronica-2025C2.json');
  const classes = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const result = solveWithCriticalPathGreedy(classes, {
    periodSearchTimeLimitMs: 80
  });

  assert.equal(result.success, true);
  assert.equal(validatePlan(classes, result).valid, true);
  assert.ok(result.totalPeriods >= 1);
});
