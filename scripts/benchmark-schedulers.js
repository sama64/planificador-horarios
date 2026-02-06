#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { generateRandomCurriculum } from '../src/lib/algorithm/random.js';
import { solveWithCriticalPathGreedy } from '../src/lib/algorithm/solvers/criticalPathGreedy.js';
import { solveWithHybridExactFirst } from '../src/lib/algorithm/solvers/hybridExactFirst.js';
import { solveWithMipMinPeriods } from '../src/lib/algorithm/solvers/mipMinPeriods.js';
import { solveWithOracleExact } from '../src/lib/algorithm/solvers/oracleExact.js';
import { validatePlan } from '../src/lib/algorithm/validate.js';

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);

  return {
    mean: values.length ? sum / values.length : 0,
    min: sorted[0] ?? 0,
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0
  };
}

function printStats(label, values, suffix = 'ms') {
  const stats = summarize(values);
  console.log(
    `${label}: mean ${stats.mean.toFixed(2)}${suffix} | min ${stats.min.toFixed(2)}${suffix} | p95 ${stats.p95.toFixed(2)}${suffix} | max ${stats.max.toFixed(2)}${suffix}`
  );
}

function runSmallOptimalityBenchmark() {
  console.log('\n== Small Optimality (oracle reference) ==');

  const greedyTimes = [];
  const hybridTimes = [];
  const mipTimes = [];
  const oracleTimes = [];
  const greedyGaps = [];
  const hybridGaps = [];
  const mipGaps = [];

  for (let seed = 1; seed <= 20; seed += 1) {
    const classes = generateRandomCurriculum({
      classCount: 10,
      seed,
      prereqProbability: 0.2,
      maxPrereqsPerClass: 2,
      maxOptionsPerClass: 3,
      maxBlocksPerOption: 2
    });

    const greedyStart = nowMs();
    const greedy = solveWithCriticalPathGreedy(classes, { periodSearchTimeLimitMs: 50 });
    greedyTimes.push(nowMs() - greedyStart);

    const hybridStart = nowMs();
    const hybrid = solveWithHybridExactFirst(classes, { timeoutMs: 2_500, minHorizonSliceMs: 20 });
    hybridTimes.push(nowMs() - hybridStart);

    const mipStart = nowMs();
    const mip = solveWithMipMinPeriods(classes, { timeoutMs: 4_500 });
    mipTimes.push(nowMs() - mipStart);

    const oracleStart = nowMs();
    const oracle = solveWithOracleExact(classes, { timeoutMs: 6_000, maxClassesForExact: 20 });
    oracleTimes.push(nowMs() - oracleStart);

    if (!greedy.success || !hybrid.success || !mip.success || !oracle.success) {
      throw new Error(`Small benchmark failed at seed ${seed}`);
    }

    if (!validatePlan(classes, greedy).valid || !validatePlan(classes, hybrid).valid || !validatePlan(classes, mip).valid) {
      throw new Error(`Validation failure at seed ${seed}`);
    }

    greedyGaps.push(greedy.totalPeriods - oracle.totalPeriods);
    hybridGaps.push(hybrid.totalPeriods - oracle.totalPeriods);
    mipGaps.push(mip.totalPeriods - oracle.totalPeriods);
  }

  printStats('greedy runtime', greedyTimes);
  printStats('hybrid runtime', hybridTimes);
  printStats('mip runtime', mipTimes);
  printStats('oracle runtime', oracleTimes);
  printStats('greedy gap vs oracle', greedyGaps, '');
  printStats('hybrid gap vs oracle', hybridGaps, '');
  printStats('mip gap vs oracle', mipGaps, '');

  console.log(`mip exact matches: ${mipGaps.filter((gap) => gap === 0).length}/${mipGaps.length}`);
}

function runScaleBenchmark() {
  console.log('\n== Scale Benchmark (period quality priority) ==');

  const sizes = [10, 20, 30, 40, 49];

  for (const size of sizes) {
    const greedyTimes = [];
    const mipTimes = [];
    const greedyPeriods = [];
    const mipPeriods = [];

    for (let run = 0; run < 10; run += 1) {
      const classes = generateRandomCurriculum({
        classCount: size,
        seed: size * 100 + run,
        prereqProbability: 0.16,
        maxPrereqsPerClass: 3,
        maxOptionsPerClass: 4,
        maxBlocksPerOption: 2
      });

      const greedyStart = nowMs();
      const greedy = solveWithCriticalPathGreedy(classes, { periodSearchTimeLimitMs: 70 });
      greedyTimes.push(nowMs() - greedyStart);

      const mipStart = nowMs();
      const mip = solveWithMipMinPeriods(classes, { timeoutMs: 4_900 });
      mipTimes.push(nowMs() - mipStart);

      if (!greedy.success || !mip.success) {
        throw new Error(`Scale benchmark failed for size ${size}`);
      }

      if (!validatePlan(classes, greedy).valid || !validatePlan(classes, mip).valid) {
        throw new Error(`Invalid schedule at size ${size}`);
      }

      greedyPeriods.push(greedy.totalPeriods);
      mipPeriods.push(mip.totalPeriods);
    }

    printStats(`size ${size} greedy runtime`, greedyTimes);
    printStats(`size ${size} mip runtime`, mipTimes);
    printStats(`size ${size} greedy periods`, greedyPeriods, '');
    printStats(`size ${size} mip periods`, mipPeriods, '');
  }
}

function runRealDatasetBenchmark() {
  console.log('\n== Real Dataset Benchmark (mecatronica-2025C2) ==');

  const datasetPath = path.resolve(process.cwd(), '..', 'mecatronica-2025C2.json');
  const classes = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const greedyTimes = [];
  const hybridTimes = [];
  const mipTimes = [];
  const greedyPeriods = [];
  const hybridPeriods = [];
  const mipPeriods = [];

  for (let run = 0; run < 8; run += 1) {
    const greedyStart = nowMs();
    const greedy = solveWithCriticalPathGreedy(classes, { periodSearchTimeLimitMs: 80 });
    greedyTimes.push(nowMs() - greedyStart);

    const hybridStart = nowMs();
    const hybrid = solveWithHybridExactFirst(classes, { timeoutMs: 2_500, minHorizonSliceMs: 40 });
    hybridTimes.push(nowMs() - hybridStart);

    const mipStart = nowMs();
    const mip = solveWithMipMinPeriods(classes, { timeoutMs: 4_900 });
    mipTimes.push(nowMs() - mipStart);

    if (!greedy.success || !hybrid.success || !mip.success) {
      throw new Error('Real dataset benchmark solver failure');
    }

    if (!validatePlan(classes, greedy).valid || !validatePlan(classes, hybrid).valid || !validatePlan(classes, mip).valid) {
      throw new Error('Real dataset benchmark invalid schedule');
    }

    greedyPeriods.push(greedy.totalPeriods);
    hybridPeriods.push(hybrid.totalPeriods);
    mipPeriods.push(mip.totalPeriods);
  }

  printStats('mecatronica greedy runtime', greedyTimes);
  printStats('mecatronica hybrid runtime', hybridTimes);
  printStats('mecatronica mip runtime', mipTimes);
  printStats('mecatronica greedy periods', greedyPeriods, '');
  printStats('mecatronica hybrid periods', hybridPeriods, '');
  printStats('mecatronica mip periods', mipPeriods, '');

  const mipSingle = solveWithMipMinPeriods(classes, { timeoutMs: 4_900 });
  console.log(
    `mecatronica mip optimality: ${mipSingle.meta.optimality} | lower=${mipSingle.meta.lowerBound} upper=${mipSingle.meta.upperBound}`
  );
  if (mipSingle.meta.horizonChecks.length > 0) {
    const checks = mipSingle.meta.horizonChecks
      .map((check) => `${check.horizon}:${check.status}:${check.runtimeMs.toFixed(1)}ms`)
      .join(', ');
    console.log(`mecatronica mip horizon checks: ${checks}`);
  }
}

function main() {
  runSmallOptimalityBenchmark();
  runScaleBenchmark();
  runRealDatasetBenchmark();
}

main();
