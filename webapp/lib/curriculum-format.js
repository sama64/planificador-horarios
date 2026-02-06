const FORMAT_VERSION = 'schedule-curriculum-v1';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScheduleBlock(block) {
  if (!block || typeof block !== 'object') {
    return null;
  }

  if (typeof block.day !== 'string' || typeof block.startTime !== 'string' || typeof block.endTime !== 'string') {
    return null;
  }

  return {
    day: block.day,
    startTime: block.startTime,
    endTime: block.endTime
  };
}

function normalizeScheduleOption(option) {
  if (!option || typeof option !== 'object') {
    return null;
  }

  let schedule = [];
  if (Array.isArray(option.schedule)) {
    schedule = option.schedule.map(normalizeScheduleBlock).filter(Boolean);
  } else if (Array.isArray(option.days) && option.startTime && option.endTime) {
    schedule = option.days
      .map((day) => normalizeScheduleBlock({ day, startTime: option.startTime, endTime: option.endTime }))
      .filter(Boolean);
  }

  if (schedule.length === 0) {
    return null;
  }

  return { schedule };
}

function normalizeClass(cls) {
  if (!cls || typeof cls !== 'object') {
    return null;
  }

  const id = toNumber(cls.id);
  if (!Number.isInteger(id)) {
    return null;
  }

  const name = typeof cls.name === 'string' && cls.name.trim() ? cls.name.trim() : `Materia ${id}`;
  const prerequisites = Array.isArray(cls.prerequisites)
    ? cls.prerequisites.map(toNumber).filter((value) => Number.isInteger(value))
    : [];

  const scheduleOptions = Array.isArray(cls.scheduleOptions)
    ? cls.scheduleOptions.map(normalizeScheduleOption).filter(Boolean)
    : [];

  if (scheduleOptions.length === 0) {
    return null;
  }

  return {
    id,
    name,
    hours: Number.isFinite(cls.hours) ? Number(cls.hours) : null,
    prerequisites,
    scheduleOptions
  };
}

export function parseCurriculumPayload(payload) {
  const envelope = {
    formatVersion: FORMAT_VERSION,
    metadata: {
      id: 'plan-personalizado',
      name: 'Plan de estudio personalizado',
      institution: '',
      degree: '',
      updatedAt: new Date().toISOString()
    },
    classes: []
  };

  if (Array.isArray(payload)) {
    envelope.classes = payload.map(normalizeClass).filter(Boolean);
    return envelope;
  }

  if (!payload || typeof payload !== 'object') {
    return envelope;
  }

  const sourceClasses = Array.isArray(payload.classes)
    ? payload.classes
    : Array.isArray(payload.curriculum)
      ? payload.curriculum
      : [];

  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

  envelope.formatVersion = typeof payload.formatVersion === 'string' ? payload.formatVersion : FORMAT_VERSION;
  envelope.metadata = {
    id: typeof metadata.id === 'string' && metadata.id.trim() ? metadata.id.trim() : envelope.metadata.id,
    name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : envelope.metadata.name,
    institution: typeof metadata.institution === 'string' ? metadata.institution : '',
    degree: typeof metadata.degree === 'string' ? metadata.degree : '',
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : envelope.metadata.updatedAt
  };
  envelope.classes = sourceClasses.map(normalizeClass).filter(Boolean);

  return envelope;
}

export function serializeCurriculumEnvelope(envelope) {
  const parsed = parseCurriculumPayload(envelope);

  return {
    formatVersion: FORMAT_VERSION,
    metadata: {
      ...parsed.metadata,
      updatedAt: new Date().toISOString()
    },
    classes: parsed.classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      hours: cls.hours,
      prerequisites: cls.prerequisites,
      scheduleOptions: cls.scheduleOptions.map((option) => ({ schedule: option.schedule }))
    }))
  };
}

export function createEmptyCurriculumEnvelope() {
  return {
    formatVersion: FORMAT_VERSION,
    metadata: {
      id: 'plan-personalizado',
      name: 'Plan de estudio personalizado',
      institution: '',
      degree: '',
      updatedAt: new Date().toISOString()
    },
    classes: []
  };
}

export { FORMAT_VERSION };
