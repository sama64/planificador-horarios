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

  for (let period = earliest; period <= latest; period += 1) {
    const assignedInPeriod = assignmentsByPeriod[period] ?? [];
    if (assignedInPeriod.length >= maxClassesPerPeriod) {
      continue;
    }

    const options = classes[classIndex].scheduleOptions;
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      let conflict = false;

      for (const other of assignedInPeriod) {
        if (conflictMatrix[classIndex][optionIndex][other.classIndex][other.optionIndex]) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        placements.push({ period, optionIndex });
      }
    }
  }

  placements.sort((a, b) => a.period - b.period);
  return placements;
}

function solveForHorizon({
  classes,
  graph,
  conflictMatrix,
  horizon,
  timeoutAt,
  maxClassesPerPeriod
}) {
  const n = classes.length;

  const latestBound = graph.tailDepth.map((depthToSink) => horizon - depthToSink + 1);
  if (latestBound.some((value) => value < 1)) {
    return { found: false, timedOut: false, exploredNodes: 0 };
  }

  const periodByClass = Array(n).fill(0);
  const optionByClass = Array(n).fill(-1);
  const assigned = Array(n).fill(false);
  const unresolvedPrereqs = graph.prereqIndices.map((prereqs) => prereqs.length);
  const assignmentsByPeriod = Array.from({ length: horizon + 1 }, () => []);

  let exploredNodes = 0;

  function pickNextClass() {
    let bestClass = -1;
    let bestPlacements = null;

    for (let classIndex = 0; classIndex < n; classIndex += 1) {
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

      if (bestClass === -1 || placements.length < bestPlacements.length) {
        bestClass = classIndex;
        bestPlacements = placements;

        if (bestPlacements.length === 1) {
          break;
        }
      }
    }

    return { classIndex: bestClass, placements: bestPlacements ?? [] };
  }

  function dfs(assignedCount) {
    if (nowMs() > timeoutAt) {
      return { found: false, timedOut: true };
    }

    if (assignedCount === n) {
      return { found: true, timedOut: false };
    }

    const next = pickNextClass();
    if (next.classIndex === -1 || next.placements.length === 0) {
      return { found: false, timedOut: false };
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

      const result = dfs(assignedCount + 1);
      if (result.found || result.timedOut) {
        return result;
      }

      for (const dependent of graph.dependentIndices[classIndex]) {
        unresolvedPrereqs[dependent] += 1;
      }

      assignmentsByPeriod[placement.period].pop();
      periodByClass[classIndex] = 0;
      optionByClass[classIndex] = -1;
      assigned[classIndex] = false;
    }

    return { found: false, timedOut: false };
  }

  const result = dfs(0);

  return {
    found: result.found,
    timedOut: result.timedOut,
    exploredNodes,
    periodByClass,
    optionByClass
  };
}

export function solveWithOracleExact(rawClasses, {
  timeoutMs = 5_000,
  maxClassesForExact = 14,
  maxClassesPerPeriod = Number.POSITIVE_INFINITY
} = {}) {
  const startedAt = nowMs();
  const classes = normalizeClasses(rawClasses);

  if (classes.length === 0) {
    return {
      success: true,
      assignments: {},
      totalPeriods: 0,
      meta: {
        solver: 'oracleExact',
        runtimeMs: nowMs() - startedAt,
        exploredNodes: 0,
        optimal: true
      }
    };
  }

  if (classes.length > maxClassesForExact) {
    return {
      success: false,
      error: `Oracle exact solver capped at ${maxClassesForExact} classes`,
      meta: {
        solver: 'oracleExact',
        runtimeMs: nowMs() - startedAt,
        capped: true
      }
    };
  }

  const graph = buildGraph(classes);
  const conflictMatrix = buildConflictMatrix(classes);

  const lowerBound = Math.max(...graph.rootDepth);

  const greedyUpper = solveWithCriticalPathGreedy(classes, { maxClassesPerPeriod, periodSearchTimeLimitMs: 20 });
  const upperBound = greedyUpper.success ? greedyUpper.totalPeriods : classes.length;

  let exploredNodes = 0;

  for (let horizon = lowerBound; horizon <= upperBound; horizon += 1) {
    const remainingMs = timeoutMs - (nowMs() - startedAt);
    if (remainingMs <= 0) {
      return {
        success: false,
        error: 'Oracle exact solver timed out',
        meta: {
          solver: 'oracleExact',
          runtimeMs: nowMs() - startedAt,
          timeout: true,
          exploredNodes
        }
      };
    }

    const result = solveForHorizon({
      classes,
      graph,
      conflictMatrix,
      horizon,
      timeoutAt: nowMs() + remainingMs,
      maxClassesPerPeriod
    });

    exploredNodes += result.exploredNodes;

    if (result.timedOut) {
      return {
        success: false,
        error: 'Oracle exact solver timed out',
        meta: {
          solver: 'oracleExact',
          runtimeMs: nowMs() - startedAt,
          timeout: true,
          exploredNodes
        }
      };
    }

    if (result.found) {
      return {
        success: true,
        assignments: assignmentsArrayToObject(classes, result.periodByClass, result.optionByClass),
        totalPeriods: horizon,
        meta: {
          solver: 'oracleExact',
          runtimeMs: nowMs() - startedAt,
          exploredNodes,
          optimal: true
        }
      };
    }
  }

  return {
    success: false,
    error: 'Oracle exact solver could not find a solution',
    meta: {
      solver: 'oracleExact',
      runtimeMs: nowMs() - startedAt,
      exploredNodes
    }
  };
}
