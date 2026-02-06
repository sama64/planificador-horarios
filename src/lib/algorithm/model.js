const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutes(time) {
  if (typeof time !== 'string' || !TIME_REGEX.test(time)) {
    throw new Error(`Invalid time format: ${String(time)}`);
  }

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeScheduleOption(option) {
  if (option && Array.isArray(option.blocks)) {
    return option.blocks.map((block) => ({
      day: block.day,
      startTime: typeof block.start === 'number' ? `${String(Math.floor(block.start / 60)).padStart(2, '0')}:${String(block.start % 60).padStart(2, '0')}` : block.startTime,
      endTime: typeof block.end === 'number' ? `${String(Math.floor(block.end / 60)).padStart(2, '0')}:${String(block.end % 60).padStart(2, '0')}` : block.endTime
    }));
  }

  if (option && Array.isArray(option.schedule)) {
    return option.schedule;
  }

  if (option && Array.isArray(option.days) && option.startTime && option.endTime) {
    return option.days.map((day) => ({ day, startTime: option.startTime, endTime: option.endTime }));
  }

  return [];
}

function normalizeBlock(block, classId, optionIndex, blockIndex) {
  if (!block || typeof block.day !== 'string') {
    throw new Error(`Invalid block day at class ${classId}, option ${optionIndex}, block ${blockIndex}`);
  }

  const start = toMinutes(block.startTime);
  const end = toMinutes(block.endTime);

  if (start >= end) {
    throw new Error(`Invalid time interval at class ${classId}, option ${optionIndex}, block ${blockIndex}`);
  }

  return {
    day: block.day,
    start,
    end
  };
}

export function normalizeClasses(rawClasses, { strictPrerequisites = true } = {}) {
  if (!Array.isArray(rawClasses)) {
    throw new Error('Expected an array of classes');
  }

  const seenIds = new Set();
  const classes = rawClasses.map((raw) => {
    if (!raw || typeof raw.id !== 'number') {
      throw new Error('Each class must have a numeric id');
    }

    if (seenIds.has(raw.id)) {
      throw new Error(`Duplicate class id ${raw.id}`);
    }
    seenIds.add(raw.id);

    const scheduleOptions = (raw.scheduleOptions || []).map((option, optionIndex) => {
      const schedule = normalizeScheduleOption(option);
      if (schedule.length === 0) {
        throw new Error(`Class ${raw.id} has an empty schedule option at index ${optionIndex}`);
      }

      const blocks = schedule.map((block, blockIndex) => normalizeBlock(block, raw.id, optionIndex, blockIndex));
      return { blocks, sourceOptionIndex: option.sourceOptionIndex ?? optionIndex };
    });

    if (scheduleOptions.length === 0) {
      throw new Error(`Class ${raw.id} has no schedule options`);
    }

    const prerequisites = Array.isArray(raw.prerequisites)
      ? [...new Set(raw.prerequisites)]
      : [];

    return {
      id: raw.id,
      name: raw.name ?? `Class ${raw.id}`,
      prerequisites,
      scheduleOptions
    };
  });

  if (strictPrerequisites) {
    const classIds = new Set(classes.map((cls) => cls.id));
    for (const cls of classes) {
      for (const prereqId of cls.prerequisites) {
        if (!classIds.has(prereqId)) {
          throw new Error(`Class ${cls.id} references missing prerequisite ${prereqId}`);
        }
      }
    }
  }

  return classes;
}

export function blocksOverlap(blockA, blockB) {
  if (blockA.day !== blockB.day) {
    return false;
  }

  return blockA.start < blockB.end && blockB.start < blockA.end;
}

export function optionsConflict(optionA, optionB) {
  for (const blockA of optionA.blocks) {
    for (const blockB of optionB.blocks) {
      if (blocksOverlap(blockA, blockB)) {
        return true;
      }
    }
  }
  return false;
}

export function buildConflictMatrix(classes) {
  const matrix = Array.from({ length: classes.length }, () => []);

  for (let i = 0; i < classes.length; i += 1) {
    const optionsI = classes[i].scheduleOptions;
    for (let oi = 0; oi < optionsI.length; oi += 1) {
      if (!matrix[i][oi]) {
        matrix[i][oi] = [];
      }

      for (let j = 0; j < classes.length; j += 1) {
        if (!matrix[i][oi][j]) {
          matrix[i][oi][j] = [];
        }

        const optionsJ = classes[j].scheduleOptions;
        for (let oj = 0; oj < optionsJ.length; oj += 1) {
          if (i === j) {
            matrix[i][oi][j][oj] = oi !== oj;
          } else {
            matrix[i][oi][j][oj] = optionsConflict(optionsI[oi], optionsJ[oj]);
          }
        }
      }
    }
  }

  return matrix;
}

export function buildGraph(classes) {
  const idToIndex = new Map(classes.map((cls, index) => [cls.id, index]));

  const prereqIndices = classes.map((cls) => cls.prerequisites.map((id) => idToIndex.get(id)));
  const dependentIndices = classes.map(() => []);

  prereqIndices.forEach((prereqs, classIndex) => {
    prereqs.forEach((prereqIndex) => {
      if (prereqIndex === undefined) {
        throw new Error(`Missing prerequisite while building graph at class index ${classIndex}`);
      }
      dependentIndices[prereqIndex].push(classIndex);
    });
  });

  const indegree = prereqIndices.map((prereqs) => prereqs.length);
  const queue = [];
  for (let i = 0; i < indegree.length; i += 1) {
    if (indegree[i] === 0) {
      queue.push(i);
    }
  }

  const topologicalOrder = [];
  while (queue.length > 0) {
    const node = queue.shift();
    topologicalOrder.push(node);

    for (const dependent of dependentIndices[node]) {
      indegree[dependent] -= 1;
      if (indegree[dependent] === 0) {
        queue.push(dependent);
      }
    }
  }

  if (topologicalOrder.length !== classes.length) {
    throw new Error('Prerequisite graph contains a cycle');
  }

  const rootDepth = Array(classes.length).fill(1);
  for (const index of topologicalOrder) {
    for (const prereqIndex of prereqIndices[index]) {
      rootDepth[index] = Math.max(rootDepth[index], rootDepth[prereqIndex] + 1);
    }
  }

  const tailDepth = Array(classes.length).fill(1);
  for (let k = topologicalOrder.length - 1; k >= 0; k -= 1) {
    const index = topologicalOrder[k];
    for (const dependent of dependentIndices[index]) {
      tailDepth[index] = Math.max(tailDepth[index], tailDepth[dependent] + 1);
    }
  }

  return {
    idToIndex,
    prereqIndices,
    dependentIndices,
    topologicalOrder,
    rootDepth,
    tailDepth
  };
}

export function assignmentsArrayToObject(classes, periodByClass, optionByClass) {
  const assignments = {};

  for (let i = 0; i < classes.length; i += 1) {
    assignments[classes[i].id] = {
      period: periodByClass[i],
      optionIndex: optionByClass[i]
    };
  }

  return assignments;
}
