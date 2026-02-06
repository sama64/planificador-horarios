import { buildConflictMatrix, normalizeClasses } from './model.js';

export function validatePlan(rawClasses, plan, { requireAllClasses = true } = {}) {
  const classes = normalizeClasses(rawClasses);
  const conflictMatrix = buildConflictMatrix(classes);

  const violations = [];
  const classById = new Map(classes.map((cls, index) => [cls.id, { cls, index }]));

  const assignmentEntries = Object.entries(plan?.assignments || {});
  const periodByClass = Array(classes.length).fill(null);
  const optionByClass = Array(classes.length).fill(null);

  for (const [classIdRaw, assignment] of assignmentEntries) {
    const classId = Number(classIdRaw);
    if (!classById.has(classId)) {
      violations.push({ type: 'UNKNOWN_CLASS', classId });
      continue;
    }

    if (!assignment || typeof assignment !== 'object') {
      violations.push({ type: 'INVALID_ASSIGNMENT', classId });
      continue;
    }

    const { index, cls } = classById.get(classId);
    const period = assignment.period;
    const optionIndex = assignment.optionIndex;

    if (!Number.isInteger(period) || period < 1) {
      violations.push({ type: 'INVALID_PERIOD', classId, period });
      continue;
    }

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= cls.scheduleOptions.length) {
      violations.push({ type: 'INVALID_OPTION', classId, optionIndex });
      continue;
    }

    if (periodByClass[index] !== null) {
      violations.push({ type: 'DUPLICATE_ASSIGNMENT', classId });
      continue;
    }

    periodByClass[index] = period;
    optionByClass[index] = optionIndex;
  }

  if (requireAllClasses) {
    classes.forEach((cls, index) => {
      if (periodByClass[index] === null) {
        violations.push({ type: 'MISSING_CLASS', classId: cls.id });
      }
    });
  }

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const period = periodByClass[classIndex];
    if (period === null) {
      continue;
    }

    for (const prereqId of classes[classIndex].prerequisites) {
      const prereqIndex = classById.get(prereqId)?.index;
      if (prereqIndex === undefined) {
        violations.push({ type: 'UNKNOWN_PREREQUISITE', classId: classes[classIndex].id, prerequisiteId: prereqId });
        continue;
      }

      const prereqPeriod = periodByClass[prereqIndex];
      if (prereqPeriod === null) {
        violations.push({ type: 'MISSING_PREREQUISITE_ASSIGNMENT', classId: classes[classIndex].id, prerequisiteId: prereqId });
      } else if (prereqPeriod >= period) {
        violations.push({
          type: 'PREREQUISITE_ORDER',
          classId: classes[classIndex].id,
          prerequisiteId: prereqId,
          classPeriod: period,
          prerequisitePeriod: prereqPeriod
        });
      }
    }
  }

  const byPeriod = new Map();
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const period = periodByClass[classIndex];
    if (period === null) {
      continue;
    }

    if (!byPeriod.has(period)) {
      byPeriod.set(period, []);
    }

    byPeriod.get(period).push(classIndex);
  }

  for (const [period, classIndices] of byPeriod.entries()) {
    for (let i = 0; i < classIndices.length; i += 1) {
      const classA = classIndices[i];
      const optionA = optionByClass[classA];

      for (let j = i + 1; j < classIndices.length; j += 1) {
        const classB = classIndices[j];
        const optionB = optionByClass[classB];

        if (conflictMatrix[classA][optionA][classB][optionB]) {
          violations.push({
            type: 'TIME_CONFLICT',
            period,
            classAId: classes[classA].id,
            classBId: classes[classB].id,
            optionA,
            optionB
          });
        }
      }
    }
  }

  const totalPeriods = plan?.totalPeriods;
  if (totalPeriods !== undefined && Number.isInteger(totalPeriods)) {
    const maxPeriod = Math.max(0, ...periodByClass.filter((value) => value !== null));
    if (totalPeriods !== maxPeriod) {
      violations.push({ type: 'PERIOD_COUNT_MISMATCH', expected: maxPeriod, actual: totalPeriods });
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
