const CATALOG_FORMAT_V1 = 'schedule-catalog-v1';
const CATALOG_FORMAT_V2 = 'schedule-catalog-v2';

function toIdSafe(value, fallback = 'general') {
  const raw = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return raw || fallback;
}

function makeLogoText(value, fallback = 'UNI') {
  const tokens = String(value || '')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return fallback;
  }
  return tokens
    .map((token) => token[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3);
}

function normalizeUniversity(rawUniversity) {
  const name = String(rawUniversity?.name || rawUniversity?.shortName || 'Universidad general');
  const id = toIdSafe(rawUniversity?.id || name, 'universidad-general');

  return {
    id,
    name,
    shortName: String(rawUniversity?.shortName || name),
    logoUrl: typeof rawUniversity?.logoUrl === 'string' ? rawUniversity.logoUrl : '',
    logoText: String(rawUniversity?.logoText || makeLogoText(rawUniversity?.shortName || name, 'UNI'))
  };
}

function normalizeFaculty(rawFaculty, fallbackUniversityId) {
  const name = String(rawFaculty?.name || rawFaculty?.shortName || 'Facultad general');
  const id = toIdSafe(rawFaculty?.id || `${fallbackUniversityId}-${name}`, `${fallbackUniversityId}-facultad-general`);
  const universityId = toIdSafe(rawFaculty?.universityId || fallbackUniversityId, fallbackUniversityId);

  return {
    id,
    universityId,
    name,
    shortName: String(rawFaculty?.shortName || name),
    logoUrl: typeof rawFaculty?.logoUrl === 'string' ? rawFaculty.logoUrl : '',
    logoText: String(rawFaculty?.logoText || makeLogoText(rawFaculty?.shortName || name, 'FAC'))
  };
}

function normalizePlan(rawPlan, universityMap, facultyMap) {
  const universityId = toIdSafe(
    rawPlan?.universityId || rawPlan?.institution || rawPlan?.universityName || 'universidad-general',
    'universidad-general'
  );

  const university =
    universityMap.get(universityId) ||
    normalizeUniversity({
      id: universityId,
      name: rawPlan?.universityName || rawPlan?.institution || 'Universidad general'
    });

  const facultyId = toIdSafe(
    rawPlan?.facultyId || rawPlan?.facultyName || `${university.id}-facultad-general`,
    `${university.id}-facultad-general`
  );

  const faculty =
    facultyMap.get(facultyId) ||
    normalizeFaculty(
      {
        id: facultyId,
        universityId: university.id,
        name: rawPlan?.facultyName || 'Facultad general'
      },
      university.id
    );

  return {
    id: String(rawPlan?.id || ''),
    name: String(rawPlan?.name || 'Plan sin nombre'),
    file: String(rawPlan?.file || ''),
    lastUpdated: String(rawPlan?.lastUpdated || ''),
    updatedBy: String(rawPlan?.updatedBy || ''),
    career: String(rawPlan?.career || ''),
    campus: String(rawPlan?.campus || ''),
    universityId: university.id,
    facultyId: faculty.id,
    university,
    faculty
  };
}

function attachMissingEntities(plans, universityMap, facultyMap) {
  for (const plan of plans) {
    if (!universityMap.has(plan.university.id)) {
      universityMap.set(plan.university.id, plan.university);
    }
    if (!facultyMap.has(plan.faculty.id)) {
      facultyMap.set(plan.faculty.id, plan.faculty);
    }
  }
}

function parseFromLegacyArray(payload) {
  const universityMap = new Map();
  const facultyMap = new Map();

  const plans = payload
    .map((entry) => ({
      ...entry,
      universityId: entry.universityId || entry.institution || entry.universityName || 'universidad-general',
      universityName: entry.universityName || entry.institution || 'Universidad general',
      facultyId: entry.facultyId || '',
      facultyName: entry.facultyName || 'Facultad general'
    }))
    .map((entry) => {
      const university = normalizeUniversity({
        id: entry.universityId,
        name: entry.universityName
      });
      universityMap.set(university.id, university);

      const faculty = normalizeFaculty(
        {
          id: entry.facultyId || `${university.id}-${entry.facultyName}`,
          universityId: university.id,
          name: entry.facultyName
        },
        university.id
      );
      facultyMap.set(faculty.id, faculty);

      return normalizePlan(
        {
          ...entry,
          universityId: university.id,
          facultyId: faculty.id
        },
        universityMap,
        facultyMap
      );
    })
    .filter((entry) => entry.id && entry.file);

  attachMissingEntities(plans, universityMap, facultyMap);

  return {
    formatVersion: CATALOG_FORMAT_V2,
    universities: [...universityMap.values()],
    faculties: [...facultyMap.values()],
    plans
  };
}

function parseFromV1(payload) {
  const universities = Array.isArray(payload?.universities) ? payload.universities.map(normalizeUniversity) : [];
  const universityMap = new Map(universities.map((entry) => [entry.id, entry]));
  const facultyMap = new Map();

  const plans = Array.isArray(payload?.plans)
    ? payload.plans
      .map((entry) => {
        const universityId = toIdSafe(
          entry?.universityId || entry?.institution || entry?.universityName || universities[0]?.id || 'universidad-general',
          'universidad-general'
        );

        const faculty = normalizeFaculty(
          {
            id: entry?.facultyId || `${universityId}-facultad-general`,
            universityId,
            name: entry?.facultyName || 'Facultad general'
          },
          universityId
        );
        facultyMap.set(faculty.id, faculty);

        return normalizePlan(
          {
            ...entry,
            universityId,
            facultyId: faculty.id
          },
          universityMap,
          facultyMap
        );
      })
      .filter((entry) => entry.id && entry.file)
    : [];

  attachMissingEntities(plans, universityMap, facultyMap);

  return {
    formatVersion: CATALOG_FORMAT_V2,
    universities: [...universityMap.values()],
    faculties: [...facultyMap.values()],
    plans
  };
}

function parseFromV2(payload) {
  const universities = Array.isArray(payload?.universities) ? payload.universities.map(normalizeUniversity) : [];
  const universityMap = new Map(universities.map((entry) => [entry.id, entry]));

  const faculties = Array.isArray(payload?.faculties)
    ? payload.faculties.map((entry) => {
      const universityId = toIdSafe(entry?.universityId || universities[0]?.id || 'universidad-general', 'universidad-general');
      return normalizeFaculty({ ...entry, universityId }, universityId);
    })
    : [];
  const facultyMap = new Map(faculties.map((entry) => [entry.id, entry]));

  const plans = Array.isArray(payload?.plans)
    ? payload.plans
      .map((entry) => normalizePlan(entry, universityMap, facultyMap))
      .filter((entry) => entry.id && entry.file)
    : [];

  attachMissingEntities(plans, universityMap, facultyMap);

  return {
    formatVersion: CATALOG_FORMAT_V2,
    universities: [...universityMap.values()],
    faculties: [...facultyMap.values()],
    plans
  };
}

export function parseCatalogPayload(payload) {
  if (Array.isArray(payload)) {
    return parseFromLegacyArray(payload);
  }

  const formatVersion = String(payload?.formatVersion || '');
  if (formatVersion === CATALOG_FORMAT_V2) {
    return parseFromV2(payload);
  }
  if (formatVersion === CATALOG_FORMAT_V1) {
    return parseFromV1(payload);
  }

  return {
    formatVersion: CATALOG_FORMAT_V2,
    universities: [],
    faculties: [],
    plans: []
  };
}

