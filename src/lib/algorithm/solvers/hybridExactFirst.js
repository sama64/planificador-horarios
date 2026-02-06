import {
  assignmentsArrayToObject,
  buildConflictMatrix,
  buildGraph,
  normalizeClasses
} from '../model.js';
import { solveWithCriticalPathGreedy } from './criticalPathGreedy.js';

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function placementsForClass({
  classIndex,
  classes,
  graph,
  latestBound,
  periodByClass,
  assignmentsByPeriod,
  conflictMatrix,
  maxClassesPerPeriod
}) {
  let earliest = 1;
  for (const prereqIndex of graph.prereqIndices[classIndex]) {
    earliest = Math.max(earliest, periodByClass[prereqIndex] + 1);
  }

  const latest = latestBound[classIndex];
  if (earliest > latest) {
    return [];
  }

  const placements = [];
  const options = classes[classIndex].scheduleOptions;

  for (let period = earliest; period <= latest; period += 1) {
    const assignedInPeriod = assignmentsByPeriod[period] ?? [];
    if (assignedInPeriod.length >= maxClassesPerPeriod) {
      continue;
    }

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      let hasConflict = false;

      for (const other of assignedInPeriod) {
        if (conflictMatrix[classIndex][optionIndex][other.classIndex][other.optionIndex]) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        placements.push({ period, optionIndex });
      }
    }
  }

  return placements;
}

function solveHorizonFeasibility({
  classes,
  graph,
  conflictMatrix,
  horizon,
  timeoutAt,
  maxClassesPerPeriod
}) {
  const classCount = classes.length;

  const latestBound = graph.tailDepth.map((depthToSink) => horizon - depthToSink + 1);
  if (latestBound.some((value) => value < 1)) {
    return { status: 'infeasible', exploredNodes: 0 };
  }

  const periodByClass = Array(classCount).fill(0);
  const optionByClass = Array(classCount).fill(-1);
  const assigned = Array(classCount).fill(false);
  const unresolvedPrereqs = graph.prereqIndices.map((prereqs) => prereqs.length);
  const assignmentsByPeriod = Array.from({ length: horizon + 1 }, () => []);

  let exploredNodes = 0;

  function pickNextClass() {
    let selectedClass = -1;
    let selectedPlacements = null;

    for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
      if (assigned[classIndex] || unresolvedPrereqs[classIndex] !== 0) {
        continue;
      }

      const placements = placementsForClass({
        classIndex,
        classes,
        graph,
        latestBound,
        periodByClass,
        assignmentsByPeriod,
        conflictMatrix,
        maxClassesPerPeriod
      });

      if (placements.length === 0) {
        return { classIndex, placements };
      }

      if (selectedClass === -1) {
        selectedClass = classIndex;
        selectedPlacements = placements;
        continue;
      }

      if (placements.length < selectedPlacements.length) {
        selectedClass = classIndex;
        selectedPlacements = placements;
        continue;
      }

      if (placements.length === selectedPlacements.length) {
        const criticalityDiff = graph.tailDepth[classIndex] - graph.tailDepth[selectedClass];
        if (criticalityDiff > 0) {
          selectedClass = classIndex;
          selectedPlacements = placements;
          continue;
        }

        if (criticalityDiff === 0 && classes[classIndex].scheduleOptions.length < classes[selectedClass].scheduleOptions.length) {
          selectedClass = classIndex;
          selectedPlacements = placements;
        }
      }
    }

    return { classIndex: selectedClass, placements: selectedPlacements ?? [] };
  }

  function dfs(assignedCount) {
    if (nowMs() > timeoutAt) {
      return 'timeout';
    }

    if (assignedCount === classCount) {
      return 'found';
    }

    const next = pickNextClass();
    if (next.classIndex === -1 || next.placements.length === 0) {
      return 'infeasible';
    }

    const classIndex = next.classIndex;
    for (const placement of next.placements) {
      exploredNodes += 1;

      assigned[classIndex] = true;
      periodByClass[classIndex] = placement.period;
      optionByClass[classIndex] = placement.optionIndex;
      assignmentsByPeriod[placement.period].push({ classIndex, optionIndex: placement.optionIndex });

      for (const dependent of graph.dependentIndices[classIndex]) {
        unresolvedPrereqs[dependent] -= 1;
      }

      const status = dfs(assignedCount + 1);
      if (status === 'found' || status === 'timeout') {
        return status;
      }

      for (const dependent of graph.dependentIndices[classIndex]) {
        unresolvedPrereqs[dependent] += 1;
      }

      assignmentsByPeriod[placement.period].pop();
      periodByClass[classIndex] = 0;
      optionByClass[classIndex] = -1;
      assigned[classIndex] = false;
    }

    return 'infeasible';
  }

  const status = dfs(0);

  return {
    status,
    exploredNodes,
    periodByClass,
    optionByClass
  };
}

export function solveWithHybridExactFirst(rawClasses, {
  timeoutMs = 2_500,
  maxClassesPerPeriod = Number.POSITIVE_INFINITY,
  greedyPeriodSearchTimeLimitMs = 80,
  minHorizonSliceMs = 50,
  maxHorizonSliceMs = 120,
  retryTimedOutHorizons = false
} = {}) {
  const startedAt = nowMs();
  const classes = normalizeClasses(rawClasses);

  if (classes.length === 0) {
    return {
      success: true,
      assignments: {},
      totalPeriods: 0,
      meta: {
        solver: 'hybridExactFirst',
        runtimeMs: nowMs() - startedAt,
        optimality: 'optimal_proven',
        exploredNodes: 0,
        lowerBound: 0,
        greedyUpperBound: 0,
        unresolvedHorizons: []
      }
    };
  }

  const graph = buildGraph(classes);
  const conflictMatrix = buildConflictMatrix(classes);

  const lowerBound = Math.max(...graph.rootDepth);
  const greedyUpper = solveWithCriticalPathGreedy(classes, {
    maxClassesPerPeriod,
    periodSearchTimeLimitMs: greedyPeriodSearchTimeLimitMs
  });

  if (!greedyUpper.success) {
    return {
      success: false,
      error: `Greedy bootstrap failed: ${greedyUpper.error || 'unknown error'}`,
      meta: {
        solver: 'hybridExactFirst',
        runtimeMs: nowMs() - startedAt
      }
    };
  }

  let incumbentAssignments = greedyUpper.assignments;
  let incumbentPeriods = greedyUpper.totalPeriods;

  const infeasibleHorizons = new Set();
  const unresolvedHorizons = new Set();
  let exploredNodes = 0;

  for (let horizon = lowerBound; horizon < incumbentPeriods; horizon += 1) {
    const elapsed = nowMs() - startedAt;
    const remainingMs = timeoutMs - elapsed;
    if (remainingMs <= 0) {
      unresolvedHorizons.add(horizon);
      break;
    }

    const horizonsLeft = Math.max(1, incumbentPeriods - horizon);
    const sliceMs = Math.min(
      remainingMs,
      Math.max(minHorizonSliceMs, Math.min(maxHorizonSliceMs, remainingMs / horizonsLeft))
    );

    const result = solveHorizonFeasibility({
      classes,
      graph,
      conflictMatrix,
      horizon,
      timeoutAt: nowMs() + sliceMs,
      maxClassesPerPeriod
    });

    exploredNodes += result.exploredNodes;

    if (result.status === 'timeout') {
      unresolvedHorizons.add(horizon);
      continue;
    }

    if (result.status === 'found') {
      incumbentPeriods = horizon;
      incumbentAssignments = assignmentsArrayToObject(classes, result.periodByClass, result.optionByClass);
      break;
    }

    infeasibleHorizons.add(horizon);
  }

  if (retryTimedOutHorizons) {
    const horizonsToRetry = [...unresolvedHorizons].filter((horizon) => horizon < incumbentPeriods).sort((a, b) => a - b);

    for (let i = 0; i < horizonsToRetry.length; i += 1) {
      const horizon = horizonsToRetry[i];
      const elapsed = nowMs() - startedAt;
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs <= 0) {
        break;
      }

      const attemptsLeft = horizonsToRetry.length - i;
      const sliceMs = Math.max(minHorizonSliceMs, Math.min(maxHorizonSliceMs, remainingMs / attemptsLeft));

      const result = solveHorizonFeasibility({
        classes,
        graph,
        conflictMatrix,
        horizon,
        timeoutAt: nowMs() + Math.min(remainingMs, sliceMs),
        maxClassesPerPeriod
      });

      exploredNodes += result.exploredNodes;

      if (result.status === 'timeout') {
        continue;
      }

      unresolvedHorizons.delete(horizon);

      if (result.status === 'infeasible') {
        infeasibleHorizons.add(horizon);
        continue;
      }

      incumbentPeriods = horizon;
      incumbentAssignments = assignmentsArrayToObject(classes, result.periodByClass, result.optionByClass);

      for (const pendingHorizon of [...unresolvedHorizons]) {
        if (pendingHorizon >= incumbentPeriods) {
          unresolvedHorizons.delete(pendingHorizon);
        }
      }
    }
  }

  let optimality = 'feasible_not_proven';
  let canProveOptimal = true;

  for (let horizon = lowerBound; horizon < incumbentPeriods; horizon += 1) {
    if (!infeasibleHorizons.has(horizon)) {
      canProveOptimal = false;
      break;
    }
  }

  if (canProveOptimal) {
    optimality = 'optimal_proven';
  }

  return {
    success: true,
    assignments: incumbentAssignments,
    totalPeriods: incumbentPeriods,
    meta: {
      solver: 'hybridExactFirst',
      runtimeMs: nowMs() - startedAt,
      lowerBound,
      greedyUpperBound: greedyUpper.totalPeriods,
      exploredNodes,
      optimality,
      unresolvedHorizons: [...unresolvedHorizons].filter((horizon) => horizon < incumbentPeriods).sort((a, b) => a - b)
    }
  };
}
