function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function createRng(seed = 1) {
  let state = seed | 0;
  if (state === 0) {
    state = 123456789;
  }

  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function randomInt(random, min, maxInclusive) {
  return Math.floor(random() * (maxInclusive - min + 1)) + min;
}

export function pickRandomSubset(random, values, maxCount) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(random, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  const count = randomInt(random, 0, Math.min(maxCount, copy.length));
  return copy.slice(0, count);
}

export function generateRandomCurriculum({
  classCount,
  seed = 1,
  prereqProbability = 0.2,
  maxPrereqsPerClass = 3,
  maxOptionsPerClass = 3,
  maxBlocksPerOption = 2,
  days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
  timeSlots = [
    [8 * 60, 10 * 60],
    [10 * 60, 12 * 60],
    [14 * 60, 16 * 60],
    [16 * 60, 18 * 60],
    [18 * 60, 20 * 60]
  ]
} = {}) {
  const random = createRng(seed);

  const classes = [];

  for (let i = 0; i < classCount; i += 1) {
    const id = i + 1;
    const earlierIds = Array.from({ length: i }, (_, idx) => idx + 1);

    const prereqs = [];
    for (const candidateId of earlierIds) {
      if (prereqs.length >= maxPrereqsPerClass) {
        break;
      }

      if (random() < prereqProbability) {
        prereqs.push(candidateId);
      }
    }

    const optionCount = randomInt(random, 1, maxOptionsPerClass);
    const scheduleOptions = [];

    for (let o = 0; o < optionCount; o += 1) {
      const blockCount = randomInt(random, 1, maxBlocksPerOption);
      const usedPairs = new Set();
      const schedule = [];

      while (schedule.length < blockCount) {
        const day = days[randomInt(random, 0, days.length - 1)];
        const slotIndex = randomInt(random, 0, timeSlots.length - 1);
        const pairKey = `${day}|${slotIndex}`;
        if (usedPairs.has(pairKey)) {
          continue;
        }

        usedPairs.add(pairKey);
        const [start, end] = timeSlots[slotIndex];
        schedule.push({
          day,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end)
        });
      }

      scheduleOptions.push({ schedule });
    }

    classes.push({
      id,
      name: `Class ${id}`,
      prerequisites: prereqs,
      scheduleOptions
    });
  }

  return classes;
}
