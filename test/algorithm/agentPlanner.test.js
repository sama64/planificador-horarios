import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CURRICULUM_ID,
  inspectAgentCurriculum,
  listAgentCurricula,
  resolvePassedClassIds,
  runAgentRequest
} from '../../lib/agent-planner.js';

test('agent catalog exposes Mecatronica 2026 C2 as the default', () => {
  const result = listAgentCurricula();

  assert.equal(result.success, true);
  assert.equal(result.defaultCurriculumId, DEFAULT_CURRICULUM_ID);
  assert.ok(result.curricula.some((entry) => entry.id === DEFAULT_CURRICULUM_ID));
});

test('agent curriculum view includes named prerequisites and schedule options', () => {
  const result = inspectAgentCurriculum();
  const classWithPrerequisite = result.classes.find((cls) => cls.prerequisites.length > 0);

  assert.equal(result.success, true);
  assert.equal(result.curriculum.id, DEFAULT_CURRICULUM_ID);
  assert.ok(classWithPrerequisite);
  assert.equal(typeof classWithPrerequisite.prerequisites[0].name, 'string');
  assert.ok(classWithPrerequisite.scheduleOptions.length > 0);
});

test('passed classes resolve by ID and accent-insensitive exact name', () => {
  const classes = [
    { id: 1, name: 'Álgebra' },
    { id: 2, name: 'Física I' }
  ];

  assert.deepEqual(resolvePassedClassIds(classes, ['algebra', '2', 1]), [1, 2]);
  assert.throws(() => resolvePassedClassIds(classes, ['Fisica']), /Unknown passed class name/);
  assert.throws(() => resolvePassedClassIds(classes, [99]), /Unknown passed class ID/);
});

test('agent request rejects malformed passed-class input', () => {
  assert.throws(
    () => runAgentRequest({ passedClasses: 'Álgebra' }),
    /must be arrays/
  );
});

test('agent solve returns an enriched remaining plan', () => {
  const curriculum = inspectAgentCurriculum();
  const finalClass = curriculum.classes.at(-1);
  const passedClasses = curriculum.classes
    .filter((cls) => cls.id !== finalClass.id)
    .map((cls) => cls.id);

  const result = runAgentRequest({ passedClasses });

  assert.equal(result.success, true);
  assert.equal(result.curriculum.id, DEFAULT_CURRICULUM_ID);
  assert.equal(result.totalPeriods, 1);
  assert.equal(Object.values(result.scheduleByPeriod).flat().length, 1);
  assert.equal(Object.values(result.scheduleByPeriod).flat()[0].className, finalClass.name);
});

test('agent solve reports classes removed by hard constraints', () => {
  const curriculum = inspectAgentCurriculum();
  const target = curriculum.classes[0];
  const passedClasses = curriculum.classes
    .filter((cls) => cls.id !== target.id)
    .map((cls) => cls.id);
  const forbiddenDays = [...new Set(target.scheduleOptions.flatMap((option) => option.schedule.map((block) => block.day)))];

  const result = runAgentRequest({
    passedClasses,
    constraints: { forbiddenDays }
  });

  assert.equal(result.success, false);
  assert.ok(result.meta.unschedulableClasses.some((entry) => entry.classId === target.id));
});

test('soft preferences retain a feasible fallback when optimization times out', () => {
  const result = runAgentRequest({
    constraints: {
      avoidSaturdays: true,
      avoidSaturdaysMode: 'soft'
    },
    solverOptions: { timeoutMs: 1 }
  });

  assert.equal(result.success, true);
  assert.equal(result.meta.optimality, 'feasible_not_proven');
  assert.ok(result.meta.unresolvedHorizons.length > 0);
  assert.ok(Object.keys(result.assignments).length > 0);
});
