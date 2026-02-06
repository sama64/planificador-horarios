import {
  assignmentsArrayToObject,
  buildConflictMatrix,
  buildGraph,
  normalizeClasses
} from '../model.js';

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function canPlace(classIndex, optionIndex, selected, conflictMatrix) {
  for (const entry of selected) {
    if (conflictMatrix[classIndex][optionIndex][entry.classIndex][entry.optionIndex]) {
      return false;
    }
  }

  return true;
}

function greedyFallback(order, classes, conflictMatrix, maxClasses) {
  const selected = [];

  for (const classIndex of order) {
    if (selected.length >= maxClasses) {
      break;
    }

    const options = classes[classIndex].scheduleOptions;
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      if (canPlace(classIndex, optionIndex, selected, conflictMatrix)) {
        selected.push({ classIndex, optionIndex });
        break;
      }
    }
  }

  return selected;
}

function pickBestPeriodSubset(eligible, classes, conflictMatrix, graph, maxClassesPerPeriod, periodSearchTimeLimitMs) {
  const order = [...eligible].sort((a, b) => {
    const depthDiff = graph.tailDepth[b] - graph.tailDepth[a];
    if (depthDiff !== 0) {
      return depthDiff;
    }

    return classes[a].scheduleOptions.length - classes[b].scheduleOptions.length;
  });

  const startedAt = nowMs();
  let timedOut = false;

  const best = {
    count: -1,
    score: -1,
    selected: []
  };

  const selected = [];

  function updateBest() {
    let score = 0;
    for (const entry of selected) {
      score += graph.tailDepth[entry.classIndex];
    }

    if (selected.length > best.count || (selected.length === best.count && score > best.score)) {
      best.count = selected.length;
      best.score = score;
      best.selected = selected.map((entry) => ({ ...entry }));
    }
  }

  function dfs(position) {
    if (nowMs() - startedAt > periodSearchTimeLimitMs) {
      timedOut = true;
      return;
    }

    if (selected.length >= maxClassesPerPeriod || position >= order.length) {
      updateBest();
      return;
    }

    const remaining = order.length - position;
    if (selected.length + remaining < best.count) {
      return;
    }

    const classIndex = order[position];
    const options = classes[classIndex].scheduleOptions;

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      if (!canPlace(classIndex, optionIndex, selected, conflictMatrix)) {
        continue;
      }

      selected.push({ classIndex, optionIndex });
      dfs(position + 1);
      selected.pop();

      if (timedOut) {
        return;
      }
    }

    dfs(position + 1);
  }

  dfs(0);

  if (timedOut) {
    return {
      selected: greedyFallback(order, classes, conflictMatrix, maxClassesPerPeriod),
      timedOut: true
    };
  }

  return {
    selected: best.selected,
    timedOut: false
  };
}

export function solveWithCriticalPathGreedy(rawClasses, {
  maxClassesPerPeriod = Number.POSITIVE_INFINITY,
  periodSearchTimeLimitMs = 100
} = {}) {
  const startedAt = nowMs();

  const classes = normalizeClasses(rawClasses);
  const graph = buildGraph(classes);
  const conflictMatrix = buildConflictMatrix(classes);

  const periodByClass = Array(classes.length).fill(0);
  const optionByClass = Array(classes.length).fill(-1);

  const remaining = new Set(classes.map((_, index) => index));
  const completed = new Set();

  let period = 1;
  let timedOutPeriods = 0;

  while (remaining.size > 0) {
    const eligible = [];

    for (const classIndex of remaining) {
      const prereqsSatisfied = graph.prereqIndices[classIndex].every((prereqIndex) => completed.has(prereqIndex));
      if (prereqsSatisfied) {
        eligible.push(classIndex);
      }
    }

    if (eligible.length === 0) {
      return {
        success: false,
        error: 'No eligible class found. The prerequisite graph may be invalid.'
      };
    }

    const pick = pickBestPeriodSubset(
      eligible,
      classes,
      conflictMatrix,
      graph,
      maxClassesPerPeriod,
      periodSearchTimeLimitMs
    );

    if (pick.timedOut) {
      timedOutPeriods += 1;
    }

    const selected = pick.selected;
    if (selected.length === 0) {
      const classIndex = eligible[0];
      selected.push({ classIndex, optionIndex: 0 });
    }

    for (const entry of selected) {
      periodByClass[entry.classIndex] = period;
      optionByClass[entry.classIndex] = entry.optionIndex;
      completed.add(entry.classIndex);
      remaining.delete(entry.classIndex);
    }

    period += 1;

    if (period > classes.length + 1) {
      return {
        success: false,
        error: 'Unexpected period growth while building schedule'
      };
    }
  }

  const totalPeriods = Math.max(...periodByClass);

  return {
    success: true,
    assignments: assignmentsArrayToObject(classes, periodByClass, optionByClass),
    totalPeriods,
    meta: {
      solver: 'criticalPathGreedy',
      runtimeMs: nowMs() - startedAt,
      timedOutPeriods
    }
  };
}
