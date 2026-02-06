import { solveWithMipMinPeriods } from './solvers/mipMinPeriods.js';
import { normalizeClasses } from './model.js';
import { validatePlan } from './validate.js';

function canonicalizeDay(day) {
  if (typeof day !== 'string') {
    return '';
  }

  return day
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const SATURDAY_ALIASES = new Set(['sabado', 'saturday']);

function isSaturday(day) {
  return SATURDAY_ALIASES.has(canonicalizeDay(day));
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value) => typeof value === 'string' && value.trim() !== '');
}

function buildDayConstraintSet(constraints) {
  const daySet = new Set();

  for (const day of normalizeStringArray(constraints.forbiddenDays)) {
    daySet.add(canonicalizeDay(day));
  }

  for (const day of normalizeStringArray(constraints.keepFreeDays)) {
    daySet.add(canonicalizeDay(day));
  }

  if (constraints.avoidSaturdays && constraints.avoidSaturdaysMode === 'hard') {
    daySet.add('sabado');
    daySet.add('saturday');
  }

  return daySet;
}

function normalizeTimePreference(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening' || normalized === 'night') {
    return normalized;
  }

  if (normalized === 'afternoon_or_night' || normalized === 'afternoon-night') {
    return 'afternoon_or_night';
  }

  return null;
}

function isBlockInPreferenceWindow(block, preference) {
  if (preference === 'morning') {
    return block.start < 12 * 60;
  }

  if (preference === 'afternoon') {
    return block.start >= 12 * 60 && block.start < 18 * 60;
  }

  if (preference === 'evening') {
    return block.start >= 18 * 60;
  }

  if (preference === 'night') {
    return block.start >= 20 * 60;
  }

  if (preference === 'afternoon_or_night') {
    return block.start >= 12 * 60;
  }

  return true;
}

function optionMatchesTimePreference(option, preference) {
  return option.blocks.every((block) => isBlockInPreferenceWindow(block, preference));
}

function optionTimePreferencePenalty(option, preference, mismatchWeight) {
  if (!preference) {
    return 0;
  }

  let mismatches = 0;
  for (const block of option.blocks) {
    if (!isBlockInPreferenceWindow(block, preference)) {
      mismatches += 1;
    }
  }

  return mismatches * mismatchWeight;
}

function optionHasForbiddenDay(option, forbiddenDaysSet) {
  if (forbiddenDaysSet.size === 0) {
    return false;
  }

  return option.blocks.some((block) => forbiddenDaysSet.has(canonicalizeDay(block.day)));
}

function optionHasSaturday(option) {
  return option.blocks.some((block) => isSaturday(block.day));
}

function optionWeeklyMinutes(option) {
  return option.blocks.reduce((total, block) => total + (block.end - block.start), 0);
}

function normalizeConstraints(userConstraints = {}) {
  const penaltyWeights = userConstraints.penaltyWeights && typeof userConstraints.penaltyWeights === 'object'
    ? userConstraints.penaltyWeights
    : {};

  return {
    passedClassIds: Array.isArray(userConstraints.passedClassIds)
      ? userConstraints.passedClassIds.filter((id) => Number.isInteger(id))
      : [],
    forbiddenDays: normalizeStringArray(userConstraints.forbiddenDays),
    keepFreeDays: normalizeStringArray(userConstraints.keepFreeDays),
    avoidSaturdays: Boolean(userConstraints.avoidSaturdays),
    avoidSaturdaysMode: userConstraints.avoidSaturdaysMode === 'hard' ? 'hard' : 'soft',
    timePreference: normalizeTimePreference(userConstraints.timePreference),
    timePreferenceMode: userConstraints.timePreferenceMode === 'hard' ? 'hard' : 'soft',
    maxWeeklyHoursPerPeriod: Number.isFinite(userConstraints.maxWeeklyHoursPerPeriod)
      ? Number(userConstraints.maxWeeklyHoursPerPeriod)
      : null,
    maxClassesPerPeriod: Number.isFinite(userConstraints.maxClassesPerPeriod)
      ? Number(userConstraints.maxClassesPerPeriod)
      : null,
    penaltyWeights: {
      timePreference: Number.isFinite(penaltyWeights.timePreference) ? Number(penaltyWeights.timePreference) : 5,
      saturday: Number.isFinite(penaltyWeights.saturday) ? Number(penaltyWeights.saturday) : 3
    }
  };
}

function preprocessCurriculum(rawClasses, constraints) {
  const passedSet = new Set(constraints.passedClassIds);

  const activeClasses = rawClasses
    .filter((cls) => !passedSet.has(cls.id))
    .map((cls) => ({
      ...cls,
      prerequisites: Array.isArray(cls.prerequisites)
        ? cls.prerequisites.filter((prereqId) => !passedSet.has(prereqId))
        : [],
      scheduleOptions: (cls.scheduleOptions || []).map((option, optionIndex) => ({
        ...option,
        sourceOptionIndex: option.sourceOptionIndex ?? optionIndex
      }))
    }));

  return {
    activeClasses,
    passedClassIds: [...passedSet]
  };
}

function buildConstrainedDataset(rawClasses, constraints) {
  const forbiddenDaysSet = buildDayConstraintSet(constraints);
  const timePreference = constraints.timePreference;

  const classes = [];
  const optionPenaltyByClass = [];
  const optionWeeklyMinutesByClass = [];
  const filteredOutByClass = [];

  for (const cls of rawClasses) {
    const allowedOptions = [];
    const penalties = [];
    const weeklyMinutes = [];

    for (const option of cls.scheduleOptions || []) {
      if (optionHasForbiddenDay(option, forbiddenDaysSet)) {
        continue;
      }

      if (constraints.timePreferenceMode === 'hard' && timePreference && !optionMatchesTimePreference(option, timePreference)) {
        continue;
      }

      if (constraints.avoidSaturdays && constraints.avoidSaturdaysMode === 'hard' && optionHasSaturday(option)) {
        continue;
      }

      let penalty = 0;

      if (constraints.timePreferenceMode === 'soft' && timePreference) {
        penalty += optionTimePreferencePenalty(option, timePreference, constraints.penaltyWeights.timePreference);
      }

      if (constraints.avoidSaturdays && constraints.avoidSaturdaysMode === 'soft' && optionHasSaturday(option)) {
        penalty += constraints.penaltyWeights.saturday;
      }

      allowedOptions.push(option);
      penalties.push(penalty);
      weeklyMinutes.push(optionWeeklyMinutes(option));
    }

    if (allowedOptions.length === 0) {
      filteredOutByClass.push({ classId: cls.id, className: cls.name });
      continue;
    }

    classes.push({
      ...cls,
      scheduleOptions: allowedOptions
    });

    optionPenaltyByClass.push(penalties);
    optionWeeklyMinutesByClass.push(weeklyMinutes);
  }

  return {
    classes,
    optionPenaltyByClass,
    optionWeeklyMinutesByClass,
    filteredOutByClass,
    forbiddenDays: [...forbiddenDaysSet]
  };
}

function buildScheduleByPeriod(assignments) {
  const byPeriod = {};

  for (const [classId, assignment] of Object.entries(assignments)) {
    const period = assignment.period;
    if (!byPeriod[period]) {
      byPeriod[period] = [];
    }

    byPeriod[period].push({ classId: Number(classId), ...assignment });
  }

  for (const period of Object.keys(byPeriod)) {
    byPeriod[period].sort((a, b) => a.classId - b.classId);
  }

  return byPeriod;
}

export function solveScheduleWithConstraints(rawClasses, userConstraints = {}, solverOptions = {}) {
  const constraints = normalizeConstraints(userConstraints);
  const preprocessed = preprocessCurriculum(rawClasses, constraints);
  const normalizedActiveClasses = normalizeClasses(preprocessed.activeClasses);

  if (normalizedActiveClasses.length === 0) {
    return {
      success: true,
      assignments: {},
      scheduleByPeriod: {},
      totalPeriods: 0,
      meta: {
        solver: 'scheduleEntrypoint',
        optimality: 'optimal_proven',
        passedClassIds: preprocessed.passedClassIds,
        appliedConstraints: constraints
      }
    };
  }

  const constrained = buildConstrainedDataset(normalizedActiveClasses, constraints);

  if (constrained.classes.length !== preprocessed.activeClasses.length) {
    return {
      success: false,
      error: 'Some classes have no valid schedule options under current hard constraints.',
      meta: {
        solver: 'scheduleEntrypoint',
        unschedulableClasses: constrained.filteredOutByClass,
        passedClassIds: preprocessed.passedClassIds,
        appliedConstraints: constraints
      }
    };
  }

  const solverResult = solveWithMipMinPeriods(constrained.classes, {
    timeoutMs: Number.isFinite(solverOptions.timeoutMs) ? Number(solverOptions.timeoutMs) : 4_900,
    maxClassesPerPeriod: constraints.maxClassesPerPeriod ?? Number.POSITIVE_INFINITY,
    maxWeeklyMinutesPerPeriod:
      constraints.maxWeeklyHoursPerPeriod === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, Math.round(constraints.maxWeeklyHoursPerPeriod * 60)),
    optionPenaltyByClass: constrained.optionPenaltyByClass,
    optionWeeklyMinutesByClass: constrained.optionWeeklyMinutesByClass,
    greedyPeriodSearchTimeLimitMs: Number.isFinite(solverOptions.greedyPeriodSearchTimeLimitMs)
      ? Number(solverOptions.greedyPeriodSearchTimeLimitMs)
      : 80
  });

  if (!solverResult.success) {
    return solverResult;
  }

  const remappedAssignments = {};

  for (let classIndex = 0; classIndex < constrained.classes.length; classIndex += 1) {
    const cls = constrained.classes[classIndex];
    const assignment = solverResult.assignments[cls.id];

    if (!assignment) {
      continue;
    }

    const selectedOption = cls.scheduleOptions[assignment.optionIndex];
    remappedAssignments[cls.id] = {
      period: assignment.period,
      optionIndex: selectedOption?.sourceOptionIndex ?? assignment.optionIndex,
      filteredOptionIndex: assignment.optionIndex
    };
  }

  const validation = validatePlan(preprocessed.activeClasses, {
    assignments: remappedAssignments,
    totalPeriods: solverResult.totalPeriods
  });

  if (!validation.valid) {
    return {
      success: false,
      error: 'Internal validation failed after applying constraints.',
      meta: {
        solver: 'scheduleEntrypoint',
        validationViolations: validation.violations
      }
    };
  }

  return {
    success: true,
    assignments: remappedAssignments,
    scheduleByPeriod: buildScheduleByPeriod(remappedAssignments),
    totalPeriods: solverResult.totalPeriods,
    meta: {
      ...solverResult.meta,
      solver: 'scheduleEntrypoint',
      delegatedSolver: 'mipMinPeriods',
      passedClassIds: preprocessed.passedClassIds,
      appliedConstraints: constraints,
      forbiddenDaysCanonical: constrained.forbiddenDays
    }
  };
}
