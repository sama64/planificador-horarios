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

function toSlug(value, fallback = 'plan-estudio') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || fallback;
}

function hash32(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function buildAutoCurriculumId(metadata = {}, classes = []) {
  const baseSlug = toSlug(metadata?.name || '', 'plan-estudio');
  const signature = classes
    .map((cls) => `${cls.id}:${cls.name}`)
    .join('|');
  const hash = hash32(`${metadata?.institution || ''}|${baseSlug}|${signature}`).padStart(6, '0').slice(0, 6);
  return `${baseSlug}-${hash}`;
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
  const defaultMetadata = {
    id: 'plan-personalizado',
    name: 'Plan de estudio personalizado',
    institution: '',
    degree: '',
    updatedAt: new Date().toISOString()
  };

  const envelope = {
    formatVersion: FORMAT_VERSION,
    metadata: {
      ...defaultMetadata,
      id: buildAutoCurriculumId(defaultMetadata, [])
    },
    classes: []
  };

  if (Array.isArray(payload)) {
    envelope.classes = payload.map(normalizeClass).filter(Boolean);
    envelope.metadata.id = buildAutoCurriculumId(envelope.metadata, envelope.classes);
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
  envelope.metadata.id = buildAutoCurriculumId(envelope.metadata, envelope.classes);

  return envelope;
}

export function serializeCurriculumEnvelope(envelope) {
  const parsed = parseCurriculumPayload(envelope);

  return {
    formatVersion: FORMAT_VERSION,
    metadata: {
      ...parsed.metadata,
      id: buildAutoCurriculumId(parsed.metadata, parsed.classes),
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
  const metadata = {
    id: 'plan-personalizado',
    name: 'Plan de estudio personalizado',
    institution: '',
    degree: '',
    updatedAt: new Date().toISOString()
  };

  return {
    formatVersion: FORMAT_VERSION,
    metadata: {
      ...metadata,
      id: buildAutoCurriculumId(metadata, [])
    },
    classes: []
  };
}

export { FORMAT_VERSION };
