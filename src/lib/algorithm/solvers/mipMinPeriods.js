import GLPK from 'glpk.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  assignmentsArrayToObject,
  buildConflictMatrix,
  buildGraph,
  normalizeClasses
} from '../model.js';
import { solveWithCriticalPathGreedy } from './criticalPathGreedy.js';
import { solveWithHybridExactFirst } from './hybridExactFirst.js';

let cachedGlpk = null;
const require = createRequire(import.meta.url);

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getGlpk() {
  if (!cachedGlpk) {
    let wasmBinary = null;
    const cwd = process.cwd();

    const candidateWasmPaths = [
      path.join(cwd, '../node_modules/glpk.js/dist/glpk.wasm'),
      path.join(cwd, 'node_modules/glpk.js/dist/glpk.wasm')
    ];

    try {
      const resolvedPath = require.resolve('glpk.js/dist/glpk.wasm');
      candidateWasmPaths.push(resolvedPath);
    } catch {
      // Keep candidates from cwd-based guesses.
    }

    for (const wasmPath of candidateWasmPaths) {
      try {
        if (fs.existsSync(wasmPath)) {
          const data = fs.readFileSync(wasmPath);
          wasmBinary = new Uint8Array(data);
          break;
        }
      } catch {
        // Try next path.
      }
    }

    cachedGlpk = wasmBinary ? GLPK(wasmBinary) : GLPK();
  }
  return cachedGlpk;
}

function statusToLabel(glpk, status) {
  if (status === glpk.GLP_OPT) return 'optimal';
  if (status === glpk.GLP_FEAS) return 'feasible';
  if (status === glpk.GLP_NOFEAS) return 'nofeas';
  if (status === glpk.GLP_INFEAS) return 'infeas';
  if (status === glpk.GLP_UNDEF) return 'undef';
  if (status === glpk.GLP_UNBND) return 'unbounded';
  return `status_${status}`;
}

function computeOptionWeeklyMinutesByClass(classes) {
  return classes.map((cls) =>
    cls.scheduleOptions.map((option) =>
      option.blocks.reduce((total, block) => total + (block.end - block.start), 0)
    )
  );
}

function buildConflictPairs(classes, conflictMatrix) {
  const pairs = [];

  for (let classA = 0; classA < classes.length; classA += 1) {
    for (let optionA = 0; optionA < classes[classA].scheduleOptions.length; optionA += 1) {
      for (let classB = classA + 1; classB < classes.length; classB += 1) {
        for (let optionB = 0; optionB < classes[classB].scheduleOptions.length; optionB += 1) {
          if (conflictMatrix[classA][optionA][classB][optionB]) {
            pairs.push({ classA, optionA, classB, optionB });
          }
        }
      }
    }
  }

  return pairs;
}

function buildFrontLoadedTargetLoads(classCount, horizon) {
  const baseLoad = Math.floor(classCount / horizon);
  const extraLoads = classCount % horizon;

  return Array.from({ length: horizon + 1 }, (_, period) => {
    if (period === 0) {
      return 0;
    }

    return baseLoad + (period <= extraLoads ? 1 : 0);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildCurriculumBalanceProfile(classes, graph, horizon) {
  const targetLoads = buildFrontLoadedTargetLoads(classes.length, horizon);
  const preferredPeriods = Array(classes.length).fill(1);

  let period = 1;
  let assignedToCurrentPeriod = 0;

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    while (period < horizon && assignedToCurrentPeriod >= targetLoads[period]) {
      period += 1;
      assignedToCurrentPeriod = 0;
    }

    const earliest = graph.rootDepth[classIndex];
    const latest = horizon - graph.tailDepth[classIndex] + 1;
    preferredPeriods[classIndex] = clamp(period, earliest, latest);
    assignedToCurrentPeriod += 1;
  }

  return {
    targetLoads,
    preferredPeriods
  };
}

function computeBalancePenalty(period, preferredPeriod) {
  const lateness = Math.max(0, period - preferredPeriod);
  const earliness = Math.max(0, preferredPeriod - period);
  return (lateness * 3) + earliness;
}

function solveBalancedForHorizon({
  glpk,
  classes,
  graph,
  conflictPairs,
  horizon,
  maxClassesPerPeriod,
  maxWeeklyMinutesPerPeriod,
  optionPenaltyByClass,
  optionWeeklyMinutesByClass,
  optionPenaltyUpperBound,
  timeLimitMs
}) {
  const periodBounds = graph.rootDepth.map((earliest, classIndex) => {
    const latest = horizon - graph.tailDepth[classIndex] + 1;
    return { earliest, latest };
  });

  if (periodBounds.some((bound) => bound.earliest > bound.latest)) {
    return {
      status: 'infeasible',
      solved: true,
      runtimeMs: 0,
      constraintsCount: 0,
      variablesCount: 0
    };
  }

  const balanceProfile = buildCurriculumBalanceProfile(classes, graph, horizon);
  const objectiveVars = [];
  const optionPenaltyVars = [];
  const binaries = [];
  const classVariables = Array.from({ length: classes.length }, () => []);
  const classOptionPeriodVariables = Array.from({ length: classes.length }, () => []);
  const variablesByPeriod = Array.from({ length: horizon + 1 }, () => []);

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    classOptionPeriodVariables[classIndex] = Array.from(
      { length: classes[classIndex].scheduleOptions.length },
      () => Array(horizon + 1).fill(null)
    );

    const bound = periodBounds[classIndex];
    const preferredPeriod = balanceProfile.preferredPeriods[classIndex];

    for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
      const optionPenalty = optionPenaltyByClass?.[classIndex]?.[optionIndex] ?? 0;

      for (let period = bound.earliest; period <= bound.latest; period += 1) {
        const name = `x_${classIndex}_${optionIndex}_${period}`;
        classVariables[classIndex].push({ name, period });
        classOptionPeriodVariables[classIndex][optionIndex][period] = name;
        variablesByPeriod[period].push(name);
        binaries.push(name);
        optionPenaltyVars.push({ name, coef: optionPenalty });
        objectiveVars.push({
          name,
          coef: computeBalancePenalty(period, preferredPeriod)
        });
      }
    }

    if (classVariables[classIndex].length === 0) {
      return {
        status: 'infeasible',
        solved: true,
        runtimeMs: 0,
        constraintsCount: 0,
        variablesCount: binaries.length
      };
    }
  }

  const subjectTo = [];
  let constraintId = 0;

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    subjectTo.push({
      name: `c_${constraintId += 1}`,
      vars: classVariables[classIndex].map((entry) => ({ name: entry.name, coef: 1 })),
      bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 }
    });
  }

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    for (const prereqIndex of graph.prereqIndices[classIndex]) {
      const vars = [];

      for (const entry of classVariables[classIndex]) {
        vars.push({ name: entry.name, coef: entry.period });
      }

      for (const entry of classVariables[prereqIndex]) {
        vars.push({ name: entry.name, coef: -entry.period });
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_LO, lb: 1, ub: 0 }
      });
    }
  }

  for (let period = 1; period <= horizon; period += 1) {
    for (const pair of conflictPairs) {
      const varA = classOptionPeriodVariables[pair.classA][pair.optionA][period];
      const varB = classOptionPeriodVariables[pair.classB][pair.optionB][period];

      if (!varA || !varB) {
        continue;
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars: [
          { name: varA, coef: 1 },
          { name: varB, coef: 1 }
        ],
        bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 }
      });
    }
  }

  if (Number.isFinite(maxClassesPerPeriod)) {
    for (let period = 1; period <= horizon; period += 1) {
      const vars = variablesByPeriod[period].map((name) => ({ name, coef: 1 }));
      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: maxClassesPerPeriod, lb: 0 }
      });
    }
  }

  if (Number.isFinite(maxWeeklyMinutesPerPeriod)) {
    for (let period = 1; period <= horizon; period += 1) {
      const vars = [];

      for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
        for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
          const name = classOptionPeriodVariables[classIndex][optionIndex][period];
          if (!name) {
            continue;
          }

          const weeklyMinutes = optionWeeklyMinutesByClass?.[classIndex]?.[optionIndex] ?? 0;
          vars.push({ name, coef: weeklyMinutes });
        }
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: maxWeeklyMinutesPerPeriod, lb: 0 }
      });
    }
  }

  if (Number.isFinite(optionPenaltyUpperBound)) {
    subjectTo.push({
      name: `c_${constraintId += 1}`,
      vars: optionPenaltyVars,
      bnds: { type: glpk.GLP_UP, ub: optionPenaltyUpperBound, lb: 0 }
    });
  }

  const lp = {
    name: `schedule_balanced_h${horizon}`,
    objective: {
      direction: glpk.GLP_MIN,
      name: 'balance_obj',
      vars: objectiveVars
    },
    subjectTo,
    binaries
  };

  const solverResult = glpk.solve(lp, {
    msglev: glpk.GLP_MSG_OFF,
    tmlim: Math.max(0.05, timeLimitMs / 1000),
    mipgap: 0
  });

  const status = solverResult?.result?.status;

  if (status === glpk.GLP_NOFEAS || status === glpk.GLP_INFEAS) {
    return {
      status: 'infeasible',
      solved: true,
      runtimeMs: solverResult.time * 1000,
      constraintsCount: subjectTo.length,
      variablesCount: binaries.length
    };
  }

  if (status !== glpk.GLP_OPT && status !== glpk.GLP_FEAS) {
    return {
      status: 'unknown',
      solved: false,
      runtimeMs: solverResult.time * 1000,
      constraintsCount: subjectTo.length,
      variablesCount: binaries.length,
      rawStatus: statusToLabel(glpk, status)
    };
  }

  const vars = solverResult.result?.vars || {};
  const periodByClass = Array(classes.length).fill(0);
  const optionByClass = Array(classes.length).fill(-1);

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    let best = null;

    for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
      for (let period = periodBounds[classIndex].earliest; period <= periodBounds[classIndex].latest; period += 1) {
        const name = classOptionPeriodVariables[classIndex][optionIndex][period];
        if (!name) {
          continue;
        }

        const value = vars[name] || 0;
        if (value > 0.5 && (!best || value > best.value)) {
          best = { optionIndex, period, value };
        }
      }
    }

    if (!best) {
      return {
        status: 'unknown',
        solved: false,
        runtimeMs: solverResult.time * 1000,
        constraintsCount: subjectTo.length,
        variablesCount: binaries.length,
        rawStatus: 'missing_assignment'
      };
    }

    periodByClass[classIndex] = best.period;
    optionByClass[classIndex] = best.optionIndex;
  }

  return {
    status: 'feasible',
    solved: true,
    runtimeMs: solverResult.time * 1000,
    constraintsCount: subjectTo.length,
    variablesCount: binaries.length,
    assignments: assignmentsArrayToObject(classes, periodByClass, optionByClass),
    balanceProfile
  };
}

function maybeBalanceOptimalSchedule({
  glpk,
  classes,
  graph,
  conflictPairs,
  timeoutMs,
  startedAt,
  horizon,
  maxClassesPerPeriod,
  maxWeeklyMinutesPerPeriod,
  optionPenaltyByClass,
  optionWeeklyMinutesByClass,
  optionPenaltyUpperBound
}) {
  if (classes.length <= horizon) {
    return null;
  }

  const remainingMs = timeoutMs - (nowMs() - startedAt);
  if (remainingMs <= 0) {
    return null;
  }

  const balancedCheck = solveBalancedForHorizon({
    glpk,
    classes,
    graph,
    conflictPairs,
    horizon,
    maxClassesPerPeriod,
    maxWeeklyMinutesPerPeriod,
    optionPenaltyByClass,
    optionWeeklyMinutesByClass,
    optionPenaltyUpperBound,
    timeLimitMs: remainingMs
  });

  if (balancedCheck.status !== 'feasible') {
    return null;
  }

  return balancedCheck;
}

function solveFeasibilityForHorizon({
  glpk,
  classes,
  graph,
  conflictPairs,
  horizon,
  maxClassesPerPeriod,
  maxWeeklyMinutesPerPeriod,
  optionPenaltyByClass,
  optionWeeklyMinutesByClass,
  timeLimitMs
}) {
  const periodBounds = graph.rootDepth.map((earliest, classIndex) => {
    const latest = horizon - graph.tailDepth[classIndex] + 1;
    return { earliest, latest };
  });

  if (periodBounds.some((bound) => bound.earliest > bound.latest)) {
    return {
      status: 'infeasible',
      solved: true,
      runtimeMs: 0,
      constraintsCount: 0,
      variablesCount: 0
    };
  }

  const objectiveVars = [];
  const binaries = [];
  const classVariables = Array.from({ length: classes.length }, () => []);
  const classOptionPeriodVariables = Array.from({ length: classes.length }, () => []);
  const variablesByPeriod = Array.from({ length: horizon + 1 }, () => []);

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    classOptionPeriodVariables[classIndex] = Array.from(
      { length: classes[classIndex].scheduleOptions.length },
      () => Array(horizon + 1).fill(null)
    );

    const bound = periodBounds[classIndex];

    for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
      for (let period = bound.earliest; period <= bound.latest; period += 1) {
        const name = `x_${classIndex}_${optionIndex}_${period}`;
        classVariables[classIndex].push({ name, period });
        classOptionPeriodVariables[classIndex][optionIndex][period] = name;
        variablesByPeriod[period].push(name);
        binaries.push(name);
        objectiveVars.push({ name, coef: optionPenaltyByClass?.[classIndex]?.[optionIndex] ?? 0 });
      }
    }

    if (classVariables[classIndex].length === 0) {
      return {
        status: 'infeasible',
        solved: true,
        runtimeMs: 0,
        constraintsCount: 0,
        variablesCount: binaries.length
      };
    }
  }

  const subjectTo = [];
  let constraintId = 0;

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    subjectTo.push({
      name: `c_${constraintId += 1}`,
      vars: classVariables[classIndex].map((entry) => ({ name: entry.name, coef: 1 })),
      bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 }
    });
  }

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    for (const prereqIndex of graph.prereqIndices[classIndex]) {
      const vars = [];

      for (const entry of classVariables[classIndex]) {
        vars.push({ name: entry.name, coef: entry.period });
      }

      for (const entry of classVariables[prereqIndex]) {
        vars.push({ name: entry.name, coef: -entry.period });
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_LO, lb: 1, ub: 0 }
      });
    }
  }

  for (let period = 1; period <= horizon; period += 1) {
    for (const pair of conflictPairs) {
      const varA = classOptionPeriodVariables[pair.classA][pair.optionA][period];
      const varB = classOptionPeriodVariables[pair.classB][pair.optionB][period];

      if (!varA || !varB) {
        continue;
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars: [
          { name: varA, coef: 1 },
          { name: varB, coef: 1 }
        ],
        bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 }
      });
    }
  }

  if (Number.isFinite(maxClassesPerPeriod)) {
    for (let period = 1; period <= horizon; period += 1) {
      const vars = variablesByPeriod[period].map((name) => ({ name, coef: 1 }));
      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: maxClassesPerPeriod, lb: 0 }
      });
    }
  }

  if (Number.isFinite(maxWeeklyMinutesPerPeriod)) {
    for (let period = 1; period <= horizon; period += 1) {
      const vars = [];

      for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
        for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
          const name = classOptionPeriodVariables[classIndex][optionIndex][period];
          if (!name) {
            continue;
          }

          const weeklyMinutes = optionWeeklyMinutesByClass?.[classIndex]?.[optionIndex] ?? 0;
          vars.push({ name, coef: weeklyMinutes });
        }
      }

      subjectTo.push({
        name: `c_${constraintId += 1}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: maxWeeklyMinutesPerPeriod, lb: 0 }
      });
    }
  }

  const lp = {
    name: `schedule_h${horizon}`,
    objective: {
      direction: glpk.GLP_MIN,
      name: 'obj',
      vars: objectiveVars
    },
    subjectTo,
    binaries
  };

  const solverResult = glpk.solve(lp, {
    msglev: glpk.GLP_MSG_OFF,
    tmlim: Math.max(0.05, timeLimitMs / 1000),
    mipgap: 0
  });

  const status = solverResult?.result?.status;

  if (status === glpk.GLP_NOFEAS || status === glpk.GLP_INFEAS) {
    return {
      status: 'infeasible',
      solved: true,
      runtimeMs: solverResult.time * 1000,
      constraintsCount: subjectTo.length,
      variablesCount: binaries.length
    };
  }

  if (status !== glpk.GLP_OPT && status !== glpk.GLP_FEAS) {
    return {
      status: 'unknown',
      solved: false,
      runtimeMs: solverResult.time * 1000,
      constraintsCount: subjectTo.length,
      variablesCount: binaries.length,
      rawStatus: statusToLabel(glpk, status)
    };
  }

  const vars = solverResult.result?.vars || {};
  const periodByClass = Array(classes.length).fill(0);
  const optionByClass = Array(classes.length).fill(-1);

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    let best = null;

    for (let optionIndex = 0; optionIndex < classes[classIndex].scheduleOptions.length; optionIndex += 1) {
      for (let period = periodBounds[classIndex].earliest; period <= periodBounds[classIndex].latest; period += 1) {
        const name = classOptionPeriodVariables[classIndex][optionIndex][period];
        if (!name) {
          continue;
        }

        const value = vars[name] || 0;
        if (value > 0.5 && (!best || value > best.value)) {
          best = { optionIndex, period, value };
        }
      }
    }

    if (!best) {
      return {
        status: 'unknown',
        solved: false,
        runtimeMs: solverResult.time * 1000,
        constraintsCount: subjectTo.length,
        variablesCount: binaries.length,
        rawStatus: 'missing_assignment'
      };
    }

    periodByClass[classIndex] = best.period;
    optionByClass[classIndex] = best.optionIndex;
  }

  return {
    status: 'feasible',
    solved: true,
    runtimeMs: solverResult.time * 1000,
    constraintsCount: subjectTo.length,
    variablesCount: binaries.length,
    assignments: assignmentsArrayToObject(classes, periodByClass, optionByClass),
    objectiveValue: solverResult.result?.z ?? null
  };
}

export function solveWithMipMinPeriods(rawClasses, {
  timeoutMs = 4_900,
  maxClassesPerPeriod = Number.POSITIVE_INFINITY,
  maxWeeklyMinutesPerPeriod = Number.POSITIVE_INFINITY,
  optionPenaltyByClass = null,
  optionWeeklyMinutesByClass = null,
  greedyPeriodSearchTimeLimitMs = 80,
  hybridBootstrapTimeLimitMs = 1_500
} = {}) {
  const startedAt = nowMs();
  const classes = normalizeClasses(rawClasses);

  if (classes.length === 0) {
    return {
      success: true,
      assignments: {},
      totalPeriods: 0,
      meta: {
        solver: 'mipMinPeriods',
        runtimeMs: nowMs() - startedAt,
        optimality: 'optimal_proven',
        lowerBound: 0,
        upperBound: 0,
        horizonChecks: []
      }
    };
  }

  const graph = buildGraph(classes);
  const lowerBound = Math.max(...graph.rootDepth);
  const weeklyMinutesByClass = optionWeeklyMinutesByClass ?? computeOptionWeeklyMinutesByClass(classes);

  const greedy = solveWithCriticalPathGreedy(classes, {
    maxClassesPerPeriod,
    periodSearchTimeLimitMs: greedyPeriodSearchTimeLimitMs
  });

  if (!greedy.success) {
    return {
      success: false,
      error: `Greedy bootstrap failed: ${greedy.error || 'unknown error'}`,
      meta: {
        solver: 'mipMinPeriods',
        runtimeMs: nowMs() - startedAt
      }
    };
  }

  const greedyUpperBound = greedy.totalPeriods;
  let incumbentFeasible = {
    assignments: greedy.assignments,
    totalPeriods: greedy.totalPeriods,
    source: 'greedy'
  };

  const remainingAfterGreedyMs = timeoutMs - (nowMs() - startedAt);
  const shouldTryHybridBootstrap =
    classes.length > 14
    && greedyUpperBound > lowerBound
    && remainingAfterGreedyMs > 250
    && Number.isFinite(hybridBootstrapTimeLimitMs)
    && hybridBootstrapTimeLimitMs > 0;

  if (shouldTryHybridBootstrap) {
    const hybridBootstrap = solveWithHybridExactFirst(classes, {
      timeoutMs: Math.min(hybridBootstrapTimeLimitMs, Math.max(250, remainingAfterGreedyMs - 50)),
      maxClassesPerPeriod,
      greedyPeriodSearchTimeLimitMs,
      minHorizonSliceMs: 40,
      maxHorizonSliceMs: 200,
      retryTimedOutHorizons: true
    });

    if (hybridBootstrap.success && hybridBootstrap.totalPeriods < incumbentFeasible.totalPeriods) {
      incumbentFeasible = {
        assignments: hybridBootstrap.assignments,
        totalPeriods: hybridBootstrap.totalPeriods,
        source: 'hybrid'
      };
    }
  }

  const hasWeeklyHoursCap = Number.isFinite(maxWeeklyMinutesPerPeriod);
  const searchUpperBound = hasWeeklyHoursCap ? classes.length : incumbentFeasible.totalPeriods;
  const hasPenaltyObjective =
    Array.isArray(optionPenaltyByClass)
    && optionPenaltyByClass.some((penalties) => penalties.some((value) => value !== 0));
  const includeUpperBoundInSearch = hasWeeklyHoursCap || hasPenaltyObjective;

  const conflictMatrix = buildConflictMatrix(classes);
  const conflictPairs = buildConflictPairs(classes, conflictMatrix);
  const glpk = getGlpk();

  const horizonChecks = [];
  let fallbackFeasible = null;
  if (!hasWeeklyHoursCap && !hasPenaltyObjective) {
    fallbackFeasible = {
      assignments: incumbentFeasible.assignments,
      totalPeriods: incumbentFeasible.totalPeriods
    };
  }

  const horizonEnd = includeUpperBoundInSearch ? searchUpperBound : searchUpperBound - 1;
  for (let horizon = lowerBound; horizon <= horizonEnd; horizon += 1) {
    const elapsed = nowMs() - startedAt;
    const remainingMs = timeoutMs - elapsed;

    if (remainingMs <= 0) {
      if (!fallbackFeasible) {
        return {
          success: false,
          error: 'MIP solver timed out before finding a feasible schedule',
          meta: {
            solver: 'mipMinPeriods',
            runtimeMs: nowMs() - startedAt,
            lowerBound,
            upperBound: searchUpperBound,
            greedyUpperBound,
            bootstrapUpperBoundSource: incumbentFeasible.source,
            horizonChecks,
            unresolvedHorizons: [horizon]
          }
        };
      }

      return {
        success: true,
        assignments: fallbackFeasible.assignments,
        totalPeriods: fallbackFeasible.totalPeriods,
        meta: {
          solver: 'mipMinPeriods',
          runtimeMs: nowMs() - startedAt,
          optimality: 'feasible_not_proven',
          lowerBound,
          upperBound: searchUpperBound,
          greedyUpperBound,
          bootstrapUpperBoundSource: incumbentFeasible.source,
          horizonChecks,
          unresolvedHorizons: [horizon]
        }
      };
    }

    const check = solveFeasibilityForHorizon({
      glpk,
      classes,
      graph,
      conflictPairs,
      horizon,
      maxClassesPerPeriod,
      maxWeeklyMinutesPerPeriod,
      optionPenaltyByClass,
      optionWeeklyMinutesByClass: weeklyMinutesByClass,
      timeLimitMs: remainingMs
    });

    horizonChecks.push({
      horizon,
      status: check.status,
      runtimeMs: check.runtimeMs,
      constraintsCount: check.constraintsCount,
      variablesCount: check.variablesCount,
      rawStatus: check.rawStatus
    });

    if (check.status === 'feasible') {
      const balanced = maybeBalanceOptimalSchedule({
        glpk,
        classes,
        graph,
        conflictPairs,
        timeoutMs,
        startedAt,
        horizon,
        maxClassesPerPeriod,
        maxWeeklyMinutesPerPeriod,
        optionPenaltyByClass,
        optionWeeklyMinutesByClass: weeklyMinutesByClass,
        optionPenaltyUpperBound: check.objectiveValue
      });

      return {
        success: true,
        assignments: balanced?.assignments ?? check.assignments,
        totalPeriods: horizon,
        meta: {
          solver: 'mipMinPeriods',
          runtimeMs: nowMs() - startedAt,
          optimality: 'optimal_proven',
          lowerBound,
          upperBound: searchUpperBound,
          greedyUpperBound,
          bootstrapUpperBoundSource: incumbentFeasible.source,
          horizonChecks,
          balancedScheduleApplied: Boolean(balanced),
          balanceProfile: balanced?.balanceProfile ?? null
        }
      };
    }

    if (check.status === 'unknown') {
      if (!fallbackFeasible) {
        return {
          success: false,
          error: `MIP solver returned unknown status at horizon ${horizon}`,
          meta: {
            solver: 'mipMinPeriods',
            runtimeMs: nowMs() - startedAt,
            lowerBound,
            upperBound: searchUpperBound,
            greedyUpperBound,
            bootstrapUpperBoundSource: incumbentFeasible.source,
            horizonChecks,
            unresolvedHorizons: [horizon]
          }
        };
      }

      return {
        success: true,
        assignments: fallbackFeasible.assignments,
        totalPeriods: fallbackFeasible.totalPeriods,
        meta: {
          solver: 'mipMinPeriods',
          runtimeMs: nowMs() - startedAt,
          optimality: 'feasible_not_proven',
          lowerBound,
          upperBound: searchUpperBound,
          greedyUpperBound,
          bootstrapUpperBoundSource: incumbentFeasible.source,
          horizonChecks,
          unresolvedHorizons: [horizon]
        }
      };
    }
  }

  if (!fallbackFeasible) {
    return {
      success: false,
      error: 'No feasible schedule satisfies the constraints',
      meta: {
        solver: 'mipMinPeriods',
        runtimeMs: nowMs() - startedAt,
        lowerBound,
        upperBound: searchUpperBound,
        greedyUpperBound,
        bootstrapUpperBoundSource: incumbentFeasible.source,
        horizonChecks
      }
    };
  }

  const balancedFallback = !hasWeeklyHoursCap && !hasPenaltyObjective
    ? maybeBalanceOptimalSchedule({
      glpk,
      classes,
      graph,
      conflictPairs,
      timeoutMs,
      startedAt,
      horizon: fallbackFeasible.totalPeriods,
      maxClassesPerPeriod,
      maxWeeklyMinutesPerPeriod,
      optionPenaltyByClass,
      optionWeeklyMinutesByClass: weeklyMinutesByClass,
      optionPenaltyUpperBound: 0
    })
    : null;

  return {
    success: true,
    assignments: balancedFallback?.assignments ?? fallbackFeasible.assignments,
    totalPeriods: fallbackFeasible.totalPeriods,
    meta: {
      solver: 'mipMinPeriods',
      runtimeMs: nowMs() - startedAt,
      optimality: hasWeeklyHoursCap || hasPenaltyObjective ? 'feasible_not_proven' : 'optimal_proven',
      lowerBound,
      upperBound: searchUpperBound,
      greedyUpperBound,
      bootstrapUpperBoundSource: incumbentFeasible.source,
      horizonChecks,
      balancedScheduleApplied: Boolean(balancedFallback),
      balanceProfile: balancedFallback?.balanceProfile ?? null
    }
  };
}
