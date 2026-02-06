'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import CatalogPickerModal from '@/components/CatalogPickerModal.jsx';
import { parseCatalogPayload } from '@/lib/catalog-format.js';
import { DAY_OPTIONS, DEFAULT_CONSTRAINTS, TIME_PREFERENCE_OPTIONS } from '@/lib/defaults.js';
import { parseCurriculumPayload, serializeCurriculumEnvelope } from '@/lib/curriculum-format.js';

function toConstraintPayload(state, passedClassIds) {
  return {
    passedClassIds,
    forbiddenDays: state.forbiddenDays,
    keepFreeDays: state.keepFreeDays,
    avoidSaturdays: state.avoidSaturdays,
    avoidSaturdaysMode: state.avoidSaturdaysMode,
    timePreference: state.timePreference || null,
    timePreferenceMode: state.timePreferenceMode,
    maxWeeklyHoursPerPeriod: state.maxWeeklyHoursPerPeriod === '' ? null : Number(state.maxWeeklyHoursPerPeriod),
    maxClassesPerPeriod: state.maxClassesPerPeriod === '' ? null : Number(state.maxClassesPerPeriod),
    penaltyWeights: {
      timePreference: Number(state.penaltyWeights.timePreference),
      saturday: Number(state.penaltyWeights.saturday)
    }
  };
}

function toggleInArray(list, value) {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function formatScheduleBlocks(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return 'Horario no disponible';
  }

  return schedule.map((block) => `${block.day} ${block.startTime}-${block.endTime}`).join(' | ');
}

const RESULT_COLOR_PALETTE = [
  { accent: '#4f46e5', tint: 'rgba(79, 70, 229, 0.08)', panelTint: 'rgba(79, 70, 229, 0.06)', headerTint: 'rgba(79, 70, 229, 0.14)' },
  { accent: '#2563eb', tint: 'rgba(37, 99, 235, 0.08)', panelTint: 'rgba(37, 99, 235, 0.06)', headerTint: 'rgba(37, 99, 235, 0.14)' },
  { accent: '#0284c7', tint: 'rgba(2, 132, 199, 0.08)', panelTint: 'rgba(2, 132, 199, 0.06)', headerTint: 'rgba(2, 132, 199, 0.14)' },
  { accent: '#0d9488', tint: 'rgba(13, 148, 136, 0.08)', panelTint: 'rgba(13, 148, 136, 0.06)', headerTint: 'rgba(13, 148, 136, 0.14)' },
  { accent: '#059669', tint: 'rgba(5, 150, 105, 0.08)', panelTint: 'rgba(5, 150, 105, 0.06)', headerTint: 'rgba(5, 150, 105, 0.14)' },
  { accent: '#65a30d', tint: 'rgba(101, 163, 13, 0.08)', panelTint: 'rgba(101, 163, 13, 0.06)', headerTint: 'rgba(101, 163, 13, 0.14)' },
  { accent: '#ca8a04', tint: 'rgba(202, 138, 4, 0.08)', panelTint: 'rgba(202, 138, 4, 0.06)', headerTint: 'rgba(202, 138, 4, 0.14)' },
  { accent: '#ea580c', tint: 'rgba(234, 88, 12, 0.08)', panelTint: 'rgba(234, 88, 12, 0.06)', headerTint: 'rgba(234, 88, 12, 0.14)' },
  { accent: '#e11d48', tint: 'rgba(225, 29, 72, 0.08)', panelTint: 'rgba(225, 29, 72, 0.06)', headerTint: 'rgba(225, 29, 72, 0.14)' },
  { accent: '#c026d3', tint: 'rgba(192, 38, 211, 0.08)', panelTint: 'rgba(192, 38, 211, 0.06)', headerTint: 'rgba(192, 38, 211, 0.14)' },
  { accent: '#9333ea', tint: 'rgba(147, 51, 234, 0.08)', panelTint: 'rgba(147, 51, 234, 0.06)', headerTint: 'rgba(147, 51, 234, 0.14)' },
  { accent: '#7c3aed', tint: 'rgba(124, 58, 237, 0.08)', panelTint: 'rgba(124, 58, 237, 0.06)', headerTint: 'rgba(124, 58, 237, 0.14)' }
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function positiveMod(value, mod) {
  return ((value % mod) + mod) % mod;
}

function circularDistance(a, b, length) {
  const raw = Math.abs(a - b);
  return Math.min(raw, length - raw);
}

function pickColorIndexWithSeparation(baseIndex, recentIndexes, paletteLength, minDistance = 3) {
  for (let offset = 0; offset < paletteLength; offset += 1) {
    const candidate = positiveMod(baseIndex + offset, paletteLength);
    const valid = recentIndexes.every((prev) => circularDistance(candidate, prev, paletteLength) >= minDistance);
    if (valid) {
      return candidate;
    }
  }
  return baseIndex;
}

function formatUpdatedDate(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium'
  }).format(parsed);
}

function ActionIcon({ name }) {
  if (name === 'search') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0-2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2z" fill="currentColor" /></svg>;
  }
  if (name === 'import') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4h-3v6h-2V7H8l4-4zm-7 12h14v6H5v-6z" fill="currentColor" /></svg>;
  }
  if (name === 'back') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l4.6-4.6L11 5l-7 7 7 7 1.4-1.4L7.8 13H20v-2z" fill="currentColor" /></svg>;
  }
  if (name === 'text') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" fill="currentColor" /></svg>;
  }
  if (name === 'spark') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.1 5.4L20 10l-5.9 2.6L12 18l-2.1-5.4L4 10l5.9-2.6L12 2zm7 13l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15z" fill="currentColor" /></svg>;
  }
  if (name === 'settings') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1l-.3-2.4h-4l-.3 2.4c-.6.2-1.2.6-1.7 1l-2.3-.9-2 3.4 2 1.5a7.8 7.8 0 0 0 .1 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.8 1.7 1l.3 2.4h4l.3-2.4c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="currentColor" /></svg>;
  }
  return null;
}

export default function SchedulerWorkspace() {
  const pathname = usePathname();
  const [catalog, setCatalog] = useState([]);
  const [catalogUniversities, setCatalogUniversities] = useState([]);
  const [catalogFaculties, setCatalogFaculties] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [curriculum, setCurriculum] = useState(null);
  const [importText, setImportText] = useState('');

  const [search, setSearch] = useState('');
  const [passedClassIds, setPassedClassIds] = useState([]);

  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [activeSource, setActiveSource] = useState('catalog');
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [showCustomImport, setShowCustomImport] = useState(false);
  const [showOptionalPreferences, setShowOptionalPreferences] = useState(false);
  const [showAdvancedPreferences, setShowAdvancedPreferences] = useState(false);

  useEffect(() => {
    async function boot() {
      try {
        const response = await fetch('/curriculums/index.json');
        const payload = await response.json();
        const parsedCatalog = parseCatalogPayload(payload);
        setCatalog(parsedCatalog.plans);
        setCatalogUniversities(parsedCatalog.universities);
        setCatalogFaculties(parsedCatalog.faculties);

        if (parsedCatalog.plans.length > 0) {
          await loadBuiltInCurriculum(parsedCatalog.plans[0]);
          setSelectedCatalogId(parsedCatalog.plans[0].id);
        }

        const localDraft = localStorage.getItem('schedule.curriculumDraft');
        if (localDraft) {
          const parsed = parseCurriculumPayload(JSON.parse(localDraft));
          if (parsed.classes.length > 0) {
            setCurriculum(parsed);
            setSelectedCatalogId('');
            setActiveSource('custom');
            setStatus(`Plan de estudio cargado desde el editor: ${parsed.metadata.name} (${parsed.classes.length} materias)`);
            localStorage.removeItem('schedule.curriculumDraft');
          }
        }
      } catch (bootError) {
        setError(`No se pudo cargar el catalogo inicial de planes: ${bootError.message}`);
      }
    }

    boot();
  }, []);

  const classes = curriculum?.classes || [];
  const selectedCatalogPlan = useMemo(
    () => catalog.find((entry) => entry.id === selectedCatalogId) || null,
    [catalog, selectedCatalogId]
  );

  const filteredClasses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return classes;
    }

    return classes.filter((cls) =>
      `${cls.id} ${cls.name}`.toLowerCase().includes(normalizedSearch)
    );
  }, [classes, search]);

  async function loadBuiltInCurriculum(item) {
    try {
      setStatus('Cargando plan de estudio...');
      setError('');
      setResult(null);

      const response = await fetch(item.file);
      const data = await response.json();
      const parsed = parseCurriculumPayload({
        formatVersion: 'schedule-curriculum-v1',
        metadata: {
          id: item.id,
          name: item.name,
          institution: [item.university?.shortName || item.university?.name, item.faculty?.shortName || item.faculty?.name]
            .filter(Boolean)
            .join(' · ') || 'Universidad'
        },
        classes: data
      });

      setCurriculum(parsed);
      setPassedClassIds([]);
      setSelectedCatalogId(item.id);
      setActiveSource('catalog');
      setShowCustomImport(false);
      setStatus(`Plan de estudio cargado: ${parsed.metadata.name} (${parsed.classes.length} materias)`);
    } catch (loadError) {
      setError(`No se pudo cargar el plan de estudio: ${loadError.message}`);
    }
  }

  function handleSelectCatalogPlan(item) {
    loadBuiltInCurriculum(item);
    setCatalogModalOpen(false);
  }

  function handleImportText() {
    try {
      applyImportedCurriculum(JSON.parse(importText), 'texto');
    } catch (importError) {
      setError(`JSON invalido: ${importError.message}`);
    }
  }

  function applyImportedCurriculum(rawPayload, sourceLabel) {
    const parsed = parseCurriculumPayload(rawPayload);
    if (parsed.classes.length === 0) {
      throw new Error('No se detectaron materias validas.');
    }

    setCurriculum(parsed);
    setPassedClassIds([]);
    setResult(null);
    setError('');
    setSelectedCatalogId('');
    setActiveSource('custom');
    setShowCustomImport(true);
    setStatus(`Plan de estudio importado (${sourceLabel}): ${parsed.metadata.name} (${parsed.classes.length} materias)`);
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }
      setImportText(reader.result);
      try {
        applyImportedCurriculum(JSON.parse(reader.result), `archivo ${file.name}`);
      } catch (importError) {
        setError(`No se pudo importar ${file.name}: ${importError.message}`);
      }
    };
    reader.readAsText(file);
  }

  function togglePassed(id) {
    setPassedClassIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function updateConstraint(field, value) {
    setConstraints((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updatePenalty(field, value) {
    setConstraints((prev) => ({
      ...prev,
      penaltyWeights: {
        ...prev.penaltyWeights,
        [field]: value
      }
    }));
  }

  function getSaturdayPreferenceValue(currentConstraints) {
    if (!currentConstraints.avoidSaturdays) {
      return 'none';
    }
    return currentConstraints.avoidSaturdaysMode === 'hard' ? 'hard' : 'soft';
  }

  function updateSaturdayPreference(value) {
    setConstraints((prev) => ({
      ...prev,
      avoidSaturdays: value !== 'none',
      avoidSaturdaysMode: value === 'hard' ? 'hard' : 'soft'
    }));
  }

  const activePreferenceCount = useMemo(() => {
    let count = 0;
    if (constraints.timePreference) count += 1;
    if (constraints.avoidSaturdays) count += 1;
    if (constraints.maxClassesPerPeriod !== '') count += 1;
    if (constraints.maxWeeklyHoursPerPeriod !== '') count += 1;
    if (constraints.forbiddenDays.length > 0) count += 1;
    if (constraints.keepFreeDays.length > 0) count += 1;
    return count;
  }, [constraints]);

  const preferenceSummary = useMemo(() => {
    const parts = [];
    if (constraints.timePreference) {
      const option = TIME_PREFERENCE_OPTIONS.find((entry) => entry.value === constraints.timePreference);
      if (option) {
        parts.push(`Horario: ${option.label.toLowerCase()}`);
      }
    }
    if (constraints.avoidSaturdays) {
      parts.push(constraints.avoidSaturdaysMode === 'hard' ? 'Sabados bloqueados' : 'Sabados evitados');
    }
    if (constraints.forbiddenDays.length > 0) {
      parts.push(`Dias prohibidos: ${constraints.forbiddenDays.length}`);
    }
    if (constraints.keepFreeDays.length > 0) {
      parts.push(`Dias libres: ${constraints.keepFreeDays.length}`);
    }

    return parts.length > 0 ? parts.join(' · ') : 'Sin preferencias configuradas';
  }, [constraints]);

  const coloredScheduleByPeriod = useMemo(() => {
    if (!result?.scheduleByPeriod) {
      return {};
    }

    const paletteLength = RESULT_COLOR_PALETTE.length;
    const nextByPeriod = {};

    for (const [periodKey, entries] of Object.entries(result.scheduleByPeriod)) {
      const recentIndexes = [];
      nextByPeriod[periodKey] = (entries || []).map((entry) => {
        const baseIndex = positiveMod(hashString(`${entry.classId}-${entry.className}`), paletteLength);
        const finalIndex = pickColorIndexWithSeparation(baseIndex, recentIndexes, paletteLength);
        recentIndexes.push(finalIndex);
        if (recentIndexes.length > 2) {
          recentIndexes.shift();
        }

        return {
          ...entry,
          uiColor: RESULT_COLOR_PALETTE[finalIndex]
        };
      });
    }

    return nextByPeriod;
  }, [result]);

  const orderedPeriods = useMemo(
    () => Object.keys(coloredScheduleByPeriod).map(Number).sort((a, b) => a - b),
    [coloredScheduleByPeriod]
  );

  async function solveSchedule() {
    if (!curriculum || classes.length === 0) {
      setError('Primero carga un plan de estudio valido.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Optimizando plan...');
    setResult(null);

    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculum: serializeCurriculumEnvelope(curriculum),
          constraints: toConstraintPayload(constraints, passedClassIds),
          solverOptions: {
            timeoutMs: 4_900
          }
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'No se pudo resolver el plan.');
      }

      setResult(payload);
      setStatus(`Plan generado en ${payload.totalPeriods} cuatrimestes (${payload.meta.optimality}).`);
    } catch (solveError) {
      setError(solveError.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  function restoreCatalogCurriculum() {
    const selectedItem = catalog.find((entry) => entry.id === selectedCatalogId);
    const fallback = selectedItem || catalog[0];
    if (fallback) {
      loadBuiltInCurriculum(fallback);
    }
  }

  return (
    <div className="container">
      <header className="surface header">
        <h1>Planificador Academico</h1>
        <p>
          Carga un plan de estudio, marca materias regulares, ajusta preferencias y genera un plan optimizado por cantidad
          de cuatrimestes.
        </p>
        <div className="route-tabs">
          <Link href="/" className={`route-tab ${pathname === '/' ? 'active' : ''}`}>Planificador</Link>
          <Link href="/studio" className={`route-tab ${pathname === '/studio' ? 'active' : ''}`}>Editor de Plan</Link>
        </div>
      </header>

      <main className="grid">
        <section className="stack">
          <article className="surface panel">
            <h2>1. Plan de estudio</h2>
            <p>Selecciona tu carrera para empezar.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <label>Catalogo de planes</label>
              <div className="plan-source-actions">
                <button
                  type="button"
                  className="button-accent button-with-icon catalog-open-button"
                  onClick={() => setCatalogModalOpen(true)}
                  disabled={catalog.length === 0}
                >
                  <ActionIcon name="search" />
                  Ver planes
                </button>
                <button className="ghost button-with-icon plan-import-button" type="button" onClick={() => setShowCustomImport((prev) => !prev)}>
                  <ActionIcon name="import" />
                  {showCustomImport ? 'Ocultar importacion avanzada' : 'Importar'}
                </button>
              </div>
              {activeSource === 'custom' && (
                <button className="warn button-with-icon" style={{ marginTop: '0.5rem' }} type="button" onClick={restoreCatalogCurriculum}>
                  <ActionIcon name="back" />
                  Volver al catalogo
                </button>
              )}
            </div>

            {selectedCatalogPlan && activeSource === 'catalog' && (
              <div className="catalog-selection-summary">
                <strong>{selectedCatalogPlan.name}</strong>
                <div className="mono">{selectedCatalogPlan.university?.name || 'Universidad no especificada'}</div>
                <div className="mono">{selectedCatalogPlan.faculty?.name || 'Facultad no especificada'}</div>
                <div className="compact-meta">Ultima actualizacion: {formatUpdatedDate(selectedCatalogPlan.lastUpdated)}</div>
              </div>
            )}

            {showCustomImport && (
              <div className="notice warn" style={{ marginTop: '0.75rem' }}>
                <div style={{ marginBottom: '0.45rem' }}>
                  Usa esta seccion solo si vas a cargar o modificar un plan de estudio propio.
                </div>
                <div className="field-row two">
                  <div>
                    <label>Importar archivo .json</label>
                    <input className="input" type="file" accept="application/json" onChange={handleImportFile} />
                  </div>
                  <div>
                    <label>Importar desde texto</label>
                    <button className="ghost button-with-icon" onClick={handleImportText} type="button">
                      <ActionIcon name="text" />
                      Usar JSON pegado
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '0.65rem' }}>
                  <label>JSON</label>
                  <textarea
                    className="textarea"
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    placeholder="Pega aqui un plan de estudio en formato JSON"
                  />
                </div>
              </div>
            )}
            {curriculum && (
              <div className="notice ok">
                <strong>{curriculum.metadata.name}</strong>
                <div className="mono">{curriculum.classes.length} materias detectadas</div>
                <div className="mono">Fuente activa: {activeSource === 'catalog' ? 'catalogo' : 'json personalizado'}</div>
              </div>
            )}
          </article>

          <article className="surface panel">
            <h2>2. Materias Regulares</h2>
            <div style={{ marginBottom: '0.65rem' }}>
              <label>Buscar materia</label>
              <input
                className="input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej: algebra, fisica, 12"
              />
            </div>
            <div className="list-scroll">
              {filteredClasses.map((cls) => (
                <label key={cls.id} className="check-item">
                  <input
                    type="checkbox"
                    checked={passedClassIds.includes(cls.id)}
                    onChange={() => togglePassed(cls.id)}
                  />
                  <span>
                    <strong>{cls.name}</strong>
                    <span className="mono">#{cls.id}</span>
                  </span>
                </label>
              ))}
              {filteredClasses.length === 0 && <p className="mono">No hay coincidencias.</p>}
            </div>
            <p style={{ marginTop: '0.6rem' }}>
              Regulares: <strong>{passedClassIds.length}</strong>
            </p>
          </article>

          <article className="surface panel">
            <h2>3. Paso opcional: preferencias</h2>
            <p>Si no configuras nada, el plan igual se optimiza por menor cantidad de cuatrimestes.</p>

            <div className="action-row" style={{ marginTop: '0.85rem' }}>
              <button className="primary button-with-icon" onClick={solveSchedule} disabled={loading || !curriculum} type="button">
                <ActionIcon name="spark" />
                {loading ? 'Optimizando...' : 'Generar plan optimizado'}
              </button>
              <button
                className="link-button button-with-icon"
                type="button"
                onClick={() =>
                  setShowOptionalPreferences((prev) => {
                    const next = !prev;
                    if (!next) {
                      setShowAdvancedPreferences(false);
                    }
                    return next;
                  })
                }
              >
                <ActionIcon name="settings" />
                {showOptionalPreferences ? 'Ocultar preferencias' : activePreferenceCount > 0 ? 'Editar preferencias' : 'Configurar preferencias'}
              </button>
            </div>

            {!showOptionalPreferences && activePreferenceCount === 0 && (
              <div className="compact-ok" style={{ marginTop: '0.75rem' }}>
                <strong>Configuracion simple activa</strong>
                <span>Se prioriza terminar en la menor cantidad de cuatrimestes.</span>
              </div>
            )}

            {!showOptionalPreferences && activePreferenceCount > 0 && (
              <div className="compact-meta" style={{ marginTop: '0.75rem' }}>
                {preferenceSummary}
              </div>
            )}

            {showOptionalPreferences && (
              <div className="soft-panel" style={{ marginTop: '0.75rem' }}>
                <div className="action-row" style={{ marginBottom: '0.6rem' }}>
                  <span className="compact-meta">Preferencias activas: {activePreferenceCount}</span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setConstraints(DEFAULT_CONSTRAINTS);
                      setResult(null);
                      setShowAdvancedPreferences(false);
                    }}
                  >
                    Reset preferencias
                  </button>
                </div>

                <div className="field-row two" style={{ marginBottom: '0.6rem' }}>
                  <div>
                    <label>Preferencia horaria rapida</label>
                    <select
                      className="select"
                      value={constraints.timePreference}
                      onChange={(event) => updateConstraint('timePreference', event.target.value)}
                    >
                      {TIME_PREFERENCE_OPTIONS.map((item) => (
                        <option value={item.value} key={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Preferencia de sabados</label>
                    <select
                      className="select"
                      value={getSaturdayPreferenceValue(constraints)}
                      onChange={(event) => updateSaturdayPreference(event.target.value)}
                    >
                      <option value="none">Sin preferencia</option>
                      <option value="soft">Intentar evitar sabados</option>
                      <option value="hard">No cursar sabados</option>
                    </select>
                  </div>
                </div>

                <div className="action-row" style={{ marginTop: '0.4rem' }}>
                  <button className="ghost" type="button" onClick={() => setShowAdvancedPreferences((prev) => !prev)}>
                    {showAdvancedPreferences ? 'Ocultar ajustes avanzados' : 'Mostrar ajustes avanzados'}
                  </button>
                </div>

                {showAdvancedPreferences && (
                  <div className="soft-panel" style={{ marginTop: '0.75rem' }}>
                    <div style={{ marginBottom: '0.45rem' }}>
                      Ajustes avanzados para casos especiales.
                    </div>

                    <div className="field-row two" style={{ marginBottom: '0.6rem' }}>
                      <div>
                        <label>Max clases por cuatrimestre</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          value={constraints.maxClassesPerPeriod}
                          onChange={(event) => updateConstraint('maxClassesPerPeriod', event.target.value)}
                        />
                      </div>
                      <div>
                        <label>Max horas semanales por cuatrimestre</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          value={constraints.maxWeeklyHoursPerPeriod}
                          onChange={(event) => updateConstraint('maxWeeklyHoursPerPeriod', event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field-row two" style={{ marginBottom: '0.6rem' }}>
                      <div>
                        <label>Modo preferencia horaria</label>
                        <select
                          className="select"
                          value={constraints.timePreferenceMode}
                          onChange={(event) => updateConstraint('timePreferenceMode', event.target.value)}
                        >
                          <option value="soft">Suave (penaliza)</option>
                          <option value="hard">Estricto (filtra)</option>
                        </select>
                      </div>
                      <div>
                        <label>Modo sabados</label>
                        <select
                          className="select"
                          value={constraints.avoidSaturdaysMode}
                          onChange={(event) => updateConstraint('avoidSaturdaysMode', event.target.value)}
                          disabled={!constraints.avoidSaturdays}
                        >
                          <option value="soft">Suave (penaliza)</option>
                          <option value="hard">Estricto (filtra)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.6rem' }}>
                      <label>Dias prohibidos (hard)</label>
                      <div className="field-row three">
                        {DAY_OPTIONS.map((day) => (
                          <label key={`forbidden-${day}`} className="check-item" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
                            <input
                              type="checkbox"
                              checked={constraints.forbiddenDays.includes(day)}
                              onChange={() => updateConstraint('forbiddenDays', toggleInArray(constraints.forbiddenDays, day))}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.6rem' }}>
                      <label>Dias libres deseados (hard)</label>
                      <div className="field-row three">
                        {DAY_OPTIONS.map((day) => (
                          <label key={`free-${day}`} className="check-item" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
                            <input
                              type="checkbox"
                              checked={constraints.keepFreeDays.includes(day)}
                              onChange={() => updateConstraint('keepFreeDays', toggleInArray(constraints.keepFreeDays, day))}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field-row two">
                      <div>
                        <label>Peso penalty horario (soft)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={constraints.penaltyWeights.timePreference}
                          onChange={(event) => updatePenalty('timePreference', event.target.value)}
                        />
                      </div>
                      <div>
                        <label>Peso penalty sabado (soft)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={constraints.penaltyWeights.saturday}
                          onChange={(event) => updatePenalty('saturday', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        </section>

        <section className="surface panel">
          <h2>Plan generado</h2>

          {status && (result || loading) && <div className="notice ok">{status}</div>}
          {error && <div className="notice error">{error}</div>}

          {!result && !loading && !error && (
            <div className="notice warn" style={{ marginTop: '0.85rem' }}>
              Todavia no generaste un plan. Completa materias regulares y presiona "Generar plan optimizado".
            </div>
          )}

          {result && (
            <>
              <div className="meta-row" style={{ marginTop: '0.85rem' }}>
                <span className="meta-item">Cuatrimestes: {result.totalPeriods}</span>
                <span className="meta-item">Solver: {result.meta.delegatedSolver}</span>
                <span className="meta-item">Optimalidad: {result.meta.optimality}</span>
                <span className="meta-item">Runtime: {Math.round(result.meta.runtimeMs)}ms</span>
              </div>

              <div className="schedule-grid" style={{ marginTop: '0.9rem' }}>
                {orderedPeriods.map((period) => {
                  const periodColor = RESULT_COLOR_PALETTE[positiveMod(period - 1, RESULT_COLOR_PALETTE.length)];
                  return (
                    <article
                      key={period}
                      className="period-card colorized"
                      style={{
                        '--period-accent': periodColor.accent,
                        '--period-tint': periodColor.panelTint,
                        '--period-header': periodColor.headerTint
                      }}
                    >
                      <h3 className="period-title">Cuatrimestre {period}</h3>
                      {coloredScheduleByPeriod[period].map((entry) => (
                        <div
                          className="class-chip colorized"
                          key={`${period}-${entry.classId}`}
                          style={{
                            '--class-accent': entry.uiColor.accent,
                            '--class-tint': entry.uiColor.tint
                          }}
                        >
                          <div className="chip-kicker">Materia #{entry.classId}</div>
                          <strong>{entry.className}</strong>
                          <div className="mono">Opcion {entry.optionIndex + 1}</div>
                          <div className="mono">{formatScheduleBlocks(entry.schedule)}</div>
                        </div>
                      ))}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      <CatalogPickerModal
        open={catalogModalOpen}
        plans={catalog}
        universities={catalogUniversities}
        faculties={catalogFaculties}
        selectedPlanId={selectedCatalogId}
        onClose={() => setCatalogModalOpen(false)}
        onSelectPlan={handleSelectCatalogPlan}
      />
    </div>
  );
}
