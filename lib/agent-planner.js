import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { solveScheduleWithConstraints } from '../src/lib/algorithm/entrypoint.js';
import { parseCatalogPayload } from './catalog-format.js';
import { parseCurriculumPayload } from './curriculum-format.js';

export const DEFAULT_CURRICULUM_ID = 'mecatronica-2026C2';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function loadCatalog(projectRoot = PROJECT_ROOT) {
  return parseCatalogPayload(readJson(path.join(projectRoot, 'public', 'curriculums', 'index.json')));
}

export function loadCurriculum(curriculumId = DEFAULT_CURRICULUM_ID, projectRoot = PROJECT_ROOT) {
  const catalog = loadCatalog(projectRoot);
  const plan = catalog.plans.find((entry) => entry.id === curriculumId);

  if (!plan) {
    const available = catalog.plans.map((entry) => entry.id).join(', ');
    throw new Error(`Unknown curriculum "${curriculumId}". Available curricula: ${available}`);
  }

  const relativeFile = plan.file.replace(/^\/+/, '');
  const publicRoot = path.resolve(projectRoot, 'public');
  const curriculumPath = path.resolve(publicRoot, relativeFile);

  if (!curriculumPath.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error(`Curriculum "${curriculumId}" points outside the public directory.`);
  }

  const parsed = parseCurriculumPayload(readJson(curriculumPath));
  if (parsed.classes.length === 0) {
    throw new Error(`Curriculum "${curriculumId}" has no valid classes.`);
  }

  return { plan, classes: parsed.classes };
}

export function resolvePassedClassIds(classes, values = []) {
  if (!Array.isArray(values)) {
    throw new Error('passedClasses must be an array of class IDs or exact class names.');
  }

  const byId = new Map(classes.map((cls) => [cls.id, cls]));
  const byName = new Map();

  for (const cls of classes) {
    const key = canonicalize(cls.name);
    const matches = byName.get(key) || [];
    matches.push(cls);
    byName.set(key, matches);
  }

  const resolved = [];
  for (const value of values) {
    const numericId = typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : null;

    if (Number.isInteger(numericId)) {
      if (!byId.has(numericId)) {
        throw new Error(`Unknown passed class ID: ${numericId}`);
      }
      resolved.push(numericId);
      continue;
    }

    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error('Each passed class must be an integer ID or a non-empty exact name.');
    }

    const matches = byName.get(canonicalize(value)) || [];
    if (matches.length === 0) {
      throw new Error(`Unknown passed class name: "${value}"`);
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous passed class name: "${value}". Use a class ID instead.`);
    }
    resolved.push(matches[0].id);
  }

  return [...new Set(resolved)].sort((a, b) => a - b);
}

function catalogView(catalog) {
  return {
    success: true,
    defaultCurriculumId: DEFAULT_CURRICULUM_ID,
    curricula: catalog.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      career: plan.career,
      institution: plan.university?.name || '',
      faculty: plan.faculty?.name || '',
      lastUpdated: plan.lastUpdated
    }))
  };
}

function curriculumView(plan, classes) {
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  return {
    success: true,
    curriculum: {
      id: plan.id,
      name: plan.name,
      career: plan.career,
      institution: plan.university?.name || '',
      faculty: plan.faculty?.name || '',
      lastUpdated: plan.lastUpdated
    },
    classes: classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      hours: cls.hours,
      prerequisites: cls.prerequisites.map((id) => ({
        id,
        name: classMap.get(id)?.name || null
      })),
      scheduleOptions: cls.scheduleOptions
    }))
  };
}

function enrichSolveResult(plan, classes, result) {
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const classOrder = new Map(classes.map((cls, index) => [cls.id, index]));
  const scheduleByPeriod = {};

  for (const [classIdRaw, assignment] of Object.entries(result.assignments || {})) {
    const classId = Number(classIdRaw);
    const cls = classMap.get(classId);
    if (!cls) continue;

    const entries = scheduleByPeriod[assignment.period] || [];
    entries.push({
      classId,
      className: cls.name,
      optionIndex: assignment.optionIndex,
      schedule: cls.scheduleOptions[assignment.optionIndex]?.schedule || [],
      prerequisites: cls.prerequisites.map((id) => ({
        id,
        name: classMap.get(id)?.name || null
      }))
    });
    scheduleByPeriod[assignment.period] = entries;
  }

  for (const entries of Object.values(scheduleByPeriod)) {
    entries.sort((a, b) => (classOrder.get(a.classId) ?? 0) - (classOrder.get(b.classId) ?? 0));
  }

  return {
    ...result,
    curriculum: {
      id: plan.id,
      name: plan.name,
      career: plan.career,
      lastUpdated: plan.lastUpdated
    },
    scheduleByPeriod
  };
}

export function runAgentRequest(request = {}, projectRoot = PROJECT_ROOT) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('The request must be a JSON object.');
  }

  if (request.constraints !== undefined && (!request.constraints || typeof request.constraints !== 'object' || Array.isArray(request.constraints))) {
    throw new Error('constraints must be a JSON object.');
  }
  if (request.solverOptions !== undefined && (!request.solverOptions || typeof request.solverOptions !== 'object' || Array.isArray(request.solverOptions))) {
    throw new Error('solverOptions must be a JSON object.');
  }

  const curriculumId = request.curriculumId || DEFAULT_CURRICULUM_ID;
  const { plan, classes } = loadCurriculum(curriculumId, projectRoot);
  const constraintsInput = request.constraints || {};
  const explicitPassedIds = constraintsInput.passedClassIds || [];
  const passedClasses = request.passedClasses || [];
  if (!Array.isArray(explicitPassedIds) || !Array.isArray(passedClasses)) {
    throw new Error('passedClasses and constraints.passedClassIds must be arrays when provided.');
  }
  const passedClassIds = resolvePassedClassIds(classes, [
    ...explicitPassedIds,
    ...passedClasses
  ]);
  const constraints = {
    ...constraintsInput,
    passedClassIds
  };
  const solverOptions = {
    timeoutMs: 15_000,
    ...(request.solverOptions || {})
  };
  const result = solveScheduleWithConstraints(classes, constraints, solverOptions);

  return enrichSolveResult(plan, classes, result);
}

export function listAgentCurricula(projectRoot = PROJECT_ROOT) {
  return catalogView(loadCatalog(projectRoot));
}

export function inspectAgentCurriculum(curriculumId = DEFAULT_CURRICULUM_ID, projectRoot = PROJECT_ROOT) {
  const { plan, classes } = loadCurriculum(curriculumId, projectRoot);
  return curriculumView(plan, classes);
}
