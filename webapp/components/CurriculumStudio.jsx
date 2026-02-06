'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { parseCatalogPayload } from '@/lib/catalog-format.js';
import { DAY_OPTIONS } from '@/lib/defaults.js';
import { createEmptyCurriculumEnvelope, parseCurriculumPayload, serializeCurriculumEnvelope } from '@/lib/curriculum-format.js';

const SUBJECT_COLORS = [
  { accent: '#4f46e5', tint: 'rgba(79, 70, 229, 0.08)' },
  { accent: '#2563eb', tint: 'rgba(37, 99, 235, 0.08)' },
  { accent: '#0284c7', tint: 'rgba(2, 132, 199, 0.08)' },
  { accent: '#0d9488', tint: 'rgba(13, 148, 136, 0.08)' },
  { accent: '#059669', tint: 'rgba(5, 150, 105, 0.08)' },
  { accent: '#65a30d', tint: 'rgba(101, 163, 13, 0.08)' },
  { accent: '#ca8a04', tint: 'rgba(202, 138, 4, 0.08)' },
  { accent: '#ea580c', tint: 'rgba(234, 88, 12, 0.08)' },
  { accent: '#e11d48', tint: 'rgba(225, 29, 72, 0.08)' },
  { accent: '#c026d3', tint: 'rgba(192, 38, 211, 0.08)' },
  { accent: '#9333ea', tint: 'rgba(147, 51, 234, 0.08)' },
  { accent: '#7c3aed', tint: 'rgba(124, 58, 237, 0.08)' }
];

function cloneEnvelope(envelope) {
  return JSON.parse(JSON.stringify(envelope));
}

function createEmptyClass(nextId) {
  return {
    id: nextId,
    name: `Materia ${nextId}`,
    hours: null,
    prerequisites: [],
    scheduleOptions: [
      {
        schedule: [
          {
            day: 'Lunes',
            startTime: '08:00',
            endTime: '10:00'
          }
        ]
      }
    ]
  };
}

function toDownloadFile(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

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

function buildPrereqMap(classes) {
  const map = new Map();
  for (const cls of classes) {
    map.set(
      cls.id,
      (cls.prerequisites || []).filter((id) => Number.isInteger(id) && id !== cls.id)
    );
  }
  return map;
}

function hasPath(map, fromId, targetId, visited = new Set()) {
  if (fromId === targetId) {
    return true;
  }
  if (visited.has(fromId)) {
    return false;
  }
  visited.add(fromId);
  for (const nextId of map.get(fromId) || []) {
    if (hasPath(map, nextId, targetId, visited)) {
      return true;
    }
  }
  return false;
}

function detectCycleClassIds(classes) {
  const map = buildPrereqMap(classes);
  const state = new Map();
  const inCycle = new Set();
  const stack = [];

  for (const id of map.keys()) {
    state.set(id, 0);
  }

  function dfs(nodeId) {
    state.set(nodeId, 1);
    stack.push(nodeId);

    for (const depId of map.get(nodeId) || []) {
      if (!map.has(depId)) {
        continue;
      }
      const depState = state.get(depId) || 0;
      if (depState === 0) {
        dfs(depId);
      } else if (depState === 1) {
        const cycleStart = stack.indexOf(depId);
        for (let i = cycleStart; i < stack.length; i += 1) {
          inCycle.add(stack[i]);
        }
      }
    }

    stack.pop();
    state.set(nodeId, 2);
  }

  for (const id of map.keys()) {
    if ((state.get(id) || 0) === 0) {
      dfs(id);
    }
  }

  return inCycle;
}

function getClassScheduleStats(cls) {
  const options = cls.scheduleOptions || [];
  const blockCount = options.reduce((total, option) => total + (option.schedule?.length || 0), 0);
  const previewBlocks = [];
  for (const option of options) {
    for (const block of option.schedule || []) {
      previewBlocks.push(`${block.day.slice(0, 3)} ${block.startTime}-${block.endTime}`);
      if (previewBlocks.length >= 2) {
        break;
      }
    }
    if (previewBlocks.length >= 2) {
      break;
    }
  }
  return {
    optionCount: options.length,
    blockCount,
    preview: previewBlocks.join(' · ')
  };
}

function classHasSchedule(cls) {
  return (cls.scheduleOptions || []).some((option) => (option.schedule || []).length > 0);
}

export default function CurriculumStudio() {
  const pathname = usePathname();
  const fileInputRef = useRef(null);

  const [catalog, setCatalog] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [envelope, setEnvelope] = useState(createEmptyCurriculumEnvelope());
  const [importText, setImportText] = useState('');
  const [importedFileName, setImportedFileName] = useState('');
  const [showTextImport, setShowTextImport] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [classSearch, setClassSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [sortMode, setSortMode] = useState('id');
  const [expandedClassIds, setExpandedClassIds] = useState(new Set());
  const [activePrereqEditor, setActivePrereqEditor] = useState(null);
  const [prereqQueryByClassId, setPrereqQueryByClassId] = useState({});

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/curriculums/index.json');
        const payload = await response.json();
        const parsedCatalog = parseCatalogPayload(payload);
        setCatalog(parsedCatalog.plans);
      } catch (loadError) {
        setError(`No se pudo cargar catalogo: ${loadError.message}`);
      }
    }

    loadCatalog();
  }, []);

  const classes = envelope.classes || [];

  const classMap = useMemo(
    () => new Map(classes.map((cls) => [cls.id, cls])),
    [classes]
  );

  const cycleClassIds = useMemo(() => detectCycleClassIds(classes), [classes]);

  const nextClassId = useMemo(() => {
    let maxId = 0;
    for (const cls of classes) {
      maxId = Math.max(maxId, Number(cls.id) || 0);
    }
    return maxId + 1;
  }, [classes]);

  const preparedClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    const filtered = classes.filter((cls) => {
      if (query && !`${cls.id} ${cls.name}`.toLowerCase().includes(query)) {
        return false;
      }
      if (filterMode === 'no_prereq' && (cls.prerequisites || []).length > 0) {
        return false;
      }
      if (filterMode === 'no_schedule' && classHasSchedule(cls)) {
        return false;
      }
      if (filterMode === 'cycles' && !cycleClassIds.has(cls.id)) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name, 'es');
      }
      if (sortMode === 'hours') {
        return (a.hours ?? Number.POSITIVE_INFINITY) - (b.hours ?? Number.POSITIVE_INFINITY);
      }
      return a.id - b.id;
    });

    return filtered.map((cls) => ({
      cls,
      stats: getClassScheduleStats(cls),
      color: SUBJECT_COLORS[positiveMod(hashString(`${cls.id}-${cls.name}`), SUBJECT_COLORS.length)],
      inCycle: cycleClassIds.has(cls.id)
    }));
  }, [classes, classSearch, filterMode, sortMode, cycleClassIds]);

  function setErrorSafe(message) {
    setError(message);
    setNotice('');
  }

  function clearMessages() {
    setError('');
    setNotice('');
  }

  async function loadBuiltIn(item) {
    try {
      clearMessages();
      const response = await fetch(item.file);
      const json = await response.json();
      const parsed = parseCurriculumPayload({
        formatVersion: 'schedule-curriculum-v1',
        metadata: {
          id: item.id,
          name: item.name,
          institution: 'UNLaM'
        },
        classes: json
      });
      setEnvelope(parsed);
      setExpandedClassIds(new Set(parsed.classes[0] ? [parsed.classes[0].id] : []));
      setNotice(`Cargado: ${parsed.metadata.name}`);
    } catch (loadError) {
      setErrorSafe(`Error cargando plan de estudio: ${loadError.message}`);
    }
  }

  function applyImportedPayload(payload, source) {
    const parsed = parseCurriculumPayload(payload);
    if (parsed.classes.length === 0) {
      throw new Error('No hay materias validas en el JSON.');
    }

    setEnvelope(parsed);
    setExpandedClassIds(new Set(parsed.classes[0] ? [parsed.classes[0].id] : []));
    clearMessages();
    setNotice(`Importado desde ${source}: ${parsed.metadata.name}`);
  }

  function importFromText() {
    try {
      applyImportedPayload(JSON.parse(importText), 'texto');
    } catch (importError) {
      setErrorSafe(`Importacion invalida: ${importError.message}`);
    }
  }

  function importFromFile(event) {
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
      setImportedFileName(file.name);
      try {
        applyImportedPayload(JSON.parse(reader.result), `archivo ${file.name}`);
      } catch (importError) {
        setErrorSafe(`Importacion invalida: ${importError.message}`);
      }
    };
    reader.readAsText(file);
  }

  function exportCurriculum() {
    const serialized = serializeCurriculumEnvelope(envelope);
    const filename = `${serialized.metadata.id || 'plan-de-estudio'}.json`;
    toDownloadFile(JSON.stringify(serialized, null, 2), filename);
    setNotice(`Exportado ${filename}`);
  }

  function copyForPlanner() {
    const serialized = serializeCurriculumEnvelope(envelope);
    localStorage.setItem('schedule.curriculumDraft', JSON.stringify(serialized));
    setNotice('Plan de estudio guardado para abrir en el planificador.');
  }

  function updateMetadata(field, value) {
    setEnvelope((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value
      }
    }));
  }

  function updateClassById(classId, updater) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      const classIndex = next.classes.findIndex((entry) => entry.id === classId);
      if (classIndex < 0) {
        return prev;
      }
      next.classes[classIndex] = updater(next.classes[classIndex], classIndex, next.classes);
      return next;
    });
  }

  function addClass(nameOverride = null) {
    const newId = nextClassId;
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      const created = createEmptyClass(newId);
      if (nameOverride) {
        created.name = nameOverride;
      }
      next.classes.push(created);
      return next;
    });
    setExpandedClassIds(new Set([newId]));
    return newId;
  }

  function removeClass(classId) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes = next.classes.filter((entry) => entry.id !== classId);
      return next;
    });
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      next.delete(classId);
      return next;
    });
    setActivePrereqEditor((current) => (current === classId ? null : current));
  }

  function setClassField(classId, field, value) {
    updateClassById(classId, (cls) => ({
      ...cls,
      [field]: value
    }));
  }

  function addOption(classId) {
    updateClassById(classId, (cls) => ({
      ...cls,
      scheduleOptions: [
        ...(cls.scheduleOptions || []),
        {
          schedule: [
            {
              day: 'Lunes',
              startTime: '08:00',
              endTime: '10:00'
            }
          ]
        }
      ]
    }));
  }

  function removeOption(classId, optionIndex) {
    updateClassById(classId, (cls) => {
      if ((cls.scheduleOptions || []).length <= 1) {
        return cls;
      }
      const scheduleOptions = [...(cls.scheduleOptions || [])];
      scheduleOptions.splice(optionIndex, 1);
      return {
        ...cls,
        scheduleOptions
      };
    });
  }

  function addBlock(classId, optionIndex) {
    updateClassById(classId, (cls) => {
      const scheduleOptions = [...(cls.scheduleOptions || [])];
      scheduleOptions[optionIndex].schedule.push({
        day: 'Lunes',
        startTime: '08:00',
        endTime: '10:00'
      });
      return {
        ...cls,
        scheduleOptions
      };
    });
  }

  function removeBlock(classId, optionIndex, blockIndex) {
    updateClassById(classId, (cls) => {
      const scheduleOptions = [...(cls.scheduleOptions || [])];
      if ((scheduleOptions[optionIndex].schedule || []).length <= 1) {
        return cls;
      }
      scheduleOptions[optionIndex].schedule.splice(blockIndex, 1);
      return {
        ...cls,
        scheduleOptions
      };
    });
  }

  function setBlockField(classId, optionIndex, blockIndex, field, value) {
    updateClassById(classId, (cls) => {
      const scheduleOptions = [...(cls.scheduleOptions || [])];
      scheduleOptions[optionIndex].schedule[blockIndex][field] = value;
      return {
        ...cls,
        scheduleOptions
      };
    });
  }

  function toggleClassExpanded(classId) {
    setExpandedClassIds((prev) => {
      if (prev.has(classId)) {
        return new Set();
      }
      return new Set([classId]);
    });
  }

  function expandFiltered() {
    setExpandedClassIds(new Set(preparedClasses.map((entry) => entry.cls.id)));
  }

  function collapseAll() {
    setExpandedClassIds(new Set());
  }

  function updatePrereqQuery(classId, value) {
    setPrereqQueryByClassId((prev) => ({
      ...prev,
      [classId]: value
    }));
  }

  function removePrerequisite(classId, prereqId) {
    updateClassById(classId, (cls) => ({
      ...cls,
      prerequisites: (cls.prerequisites || []).filter((entry) => entry !== prereqId)
    }));
  }

  function canAddPrerequisite(classId, prereqId) {
    if (classId === prereqId) {
      return false;
    }
    const map = buildPrereqMap(classes);
    return !hasPath(map, prereqId, classId);
  }

  function addPrerequisite(classId, prereqId) {
    if (!canAddPrerequisite(classId, prereqId)) {
      setErrorSafe('No se pudo agregar esa correlativa porque generaria una dependencia circular.');
      return;
    }
    updateClassById(classId, (cls) => ({
      ...cls,
      prerequisites: [...new Set([...(cls.prerequisites || []), prereqId])]
    }));
    updatePrereqQuery(classId, '');
    setActivePrereqEditor(classId);
    setError('');
  }

  function quickCreatePrerequisite(classId, rawName) {
    const name = rawName.trim();
    if (!name) {
      return;
    }
    const newId = addClass(name);
    updateClassById(classId, (cls) => ({
      ...cls,
      prerequisites: [...new Set([...(cls.prerequisites || []), newId])]
    }));
    updatePrereqQuery(classId, '');
    setActivePrereqEditor(null);
    setNotice(`Materia creada: ${name} (#${newId})`);
    setError('');
  }

  function handlePrereqInputKeyDown(event, classId, suggestions, query, selectedPrereqs) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestions.length > 0) {
        addPrerequisite(classId, suggestions[0].id);
      } else if (query.trim()) {
        quickCreatePrerequisite(classId, query);
      }
      return;
    }

    if (event.key === 'Backspace' && !query.trim() && selectedPrereqs.length > 0) {
      removePrerequisite(classId, selectedPrereqs[selectedPrereqs.length - 1]);
      return;
    }

    if (event.key === 'Escape') {
      setActivePrereqEditor(null);
    }
  }

  return (
    <div className="container">
      <header className="surface header">
        <h1>Editor de Plan de Estudio</h1>
        <p>Ajusta o crea un plan de estudio y envialo al planificador en un click.</p>
        <div className="route-tabs">
          <Link href="/" className={`route-tab ${pathname === '/' ? 'active' : ''}`}>Planificador</Link>
          <Link href="/studio" className={`route-tab ${pathname === '/studio' ? 'active' : ''}`}>Editor de Plan</Link>
        </div>
      </header>

      <main className="stack">
        <section className="surface panel">
          <h2>Paso 1. Fuente del plan</h2>
          <p>Elige una base desde catalogo o importa tu archivo JSON.</p>

          <div className="source-grid" style={{ marginTop: '0.8rem' }}>
            <article className="source-card">
              <h3>Desde catalogo</h3>
              <label>Cargar plan de estudio</label>
              <select
                className="select"
                value={selectedCatalogId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedCatalogId(value);
                  const item = catalog.find((entry) => entry.id === value);
                  if (item) {
                    loadBuiltIn(item);
                  }
                }}
              >
                <option value="">Seleccionar...</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </article>

            <article className="source-card">
              <h3>Archivo JSON</h3>
              <p className="helper-text">Arrastra un archivo o abre el selector.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={importFromFile}
                style={{ display: 'none' }}
              />
              <button className="ghost" type="button" onClick={() => fileInputRef.current?.click()}>
                Elegir archivo
              </button>
              <div
                className="dropzone"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                Arrastra un .json aqui o toca para abrir archivos
              </div>
              {importedFileName && <span className="meta-item">Archivo: {importedFileName}</span>}
            </article>
          </div>

          <div className="action-row" style={{ marginTop: '0.85rem' }}>
            <button className="ghost" onClick={() => setShowTextImport((prev) => !prev)} type="button">
              {showTextImport ? 'Ocultar importacion por texto' : 'Importar desde texto JSON'}
            </button>
            <button className="ghost" onClick={exportCurriculum} type="button">Exportar JSON</button>
            <button className="primary" onClick={copyForPlanner} type="button">Usar en planificador</button>
            <button
              className="ghost"
              onClick={() => {
                setEnvelope(createEmptyCurriculumEnvelope());
                setExpandedClassIds(new Set());
                setNotice('Editor reiniciado.');
              }}
              type="button"
            >
              Nuevo plan
            </button>
          </div>

          {showTextImport && (
            <div className="soft-panel" style={{ marginTop: '0.75rem' }}>
              <label>Importar desde texto JSON</label>
              <textarea
                className="textarea"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Pega un plan de estudio en formato JSON"
              />
              <div style={{ marginTop: '0.55rem' }}>
                <button className="ghost" onClick={importFromText} type="button">Importar texto</button>
              </div>
            </div>
          )}

          {notice && <div className="notice ok">{notice}</div>}
          {error && <div className="notice error">{error}</div>}
        </section>

        <section className="surface panel">
          <h2>Paso 2. Metadata</h2>
          <p className="helper-text">
            ID recomendado: usa minusculas y guiones. Ejemplo: <span className="mono">mecatronica-2025-c2</span>. Se usa para importar/exportar y no se muestra al alumno.
          </p>
          <div className="field-row three metadata-grid" style={{ marginTop: '0.65rem' }}>
            <div>
              <label>ID</label>
              <input
                className="input"
                value={envelope.metadata.id || ''}
                onChange={(event) => updateMetadata('id', event.target.value)}
              />
            </div>
            <div>
              <label>Nombre</label>
              <input
                className="input"
                value={envelope.metadata.name || ''}
                onChange={(event) => updateMetadata('name', event.target.value)}
              />
            </div>
            <div>
              <label>Institucion</label>
              <input
                className="input"
                value={envelope.metadata.institution || ''}
                onChange={(event) => updateMetadata('institution', event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="surface panel">
          <div className="action-row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ marginBottom: 0 }}>Paso 3. Materias ({classes.length})</h2>
            <button className="primary" onClick={() => addClass()} type="button">Agregar materia</button>
          </div>

          <div className="studio-toolbar">
            <input
              className="input"
              value={classSearch}
              onChange={(event) => setClassSearch(event.target.value)}
              placeholder="Buscar por nombre o ID"
            />
            <select className="select" value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
              <option value="all">Todos</option>
              <option value="no_prereq">Sin correlativas</option>
              <option value="no_schedule">Sin horarios</option>
              <option value="cycles">Con conflictos</option>
            </select>
            <select className="select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="id">Ordenar por ID</option>
              <option value="name">Ordenar por nombre</option>
              <option value="hours">Ordenar por horas</option>
            </select>
            <button className="ghost" type="button" onClick={expandFiltered}>Expandir resultados</button>
            <button className="ghost" type="button" onClick={collapseAll}>Colapsar todo</button>
          </div>

          {classes.length === 0 && (
            <div className="empty-guide">
              <p className="helper-text">No hay materias cargadas todavia.</p>
              <ol>
                <li>Agrega una materia.</li>
                <li>Define correlativas y opciones de horario.</li>
                <li>Usa "Usar en planificador" para probar el resultado.</li>
              </ol>
              <div className="class-chip">
                <strong>Ejemplo: Algebra I</strong>
                <div className="mono">Correlativas: 0</div>
                <div className="mono">Opcion 1 · Lunes 08:00-10:00</div>
              </div>
            </div>
          )}

          {preparedClasses.length === 0 && classes.length > 0 && (
            <div className="notice warn">No hay materias que coincidan con los filtros actuales.</div>
          )}

          <div className="stack" style={{ marginTop: '0.8rem' }}>
            {preparedClasses.map(({ cls, stats, color, inCycle }) => {
              const isExpanded = expandedClassIds.has(cls.id);
              const selectedPrereqs = cls.prerequisites || [];
              const prereqNames = selectedPrereqs
                .map((id) => classMap.get(id)?.name || `#${id}`)
                .slice(0, 3);
              const prereqQuery = prereqQueryByClassId[cls.id] || '';
              const normalizedPrereqQuery = prereqQuery.trim().toLowerCase();

              const prereqSuggestions = classes
                .filter((candidate) => {
                  if (candidate.id === cls.id) {
                    return false;
                  }
                  if (selectedPrereqs.includes(candidate.id)) {
                    return false;
                  }
                  if (!normalizedPrereqQuery) {
                    return true;
                  }
                  return `${candidate.id} ${candidate.name}`.toLowerCase().includes(normalizedPrereqQuery);
                })
                .slice(0, 8);

              const canQuickCreate =
                prereqQuery.trim().length > 1 &&
                !classes.some((candidate) => candidate.name.trim().toLowerCase() === prereqQuery.trim().toLowerCase());

              return (
                <article
                  key={cls.id}
                  className={`subject-card ${isExpanded ? 'expanded' : ''} ${inCycle ? 'cycle' : ''}`}
                  style={{
                    '--subject-accent': color.accent,
                    '--subject-tint': color.tint
                  }}
                >
                  <button type="button" className="subject-summary" onClick={() => toggleClassExpanded(cls.id)}>
                    <div className="subject-main">
                      <div className="subject-title-row">
                        <strong>{cls.name}</strong>
                        <span className="compact-meta">#{cls.id}</span>
                        {inCycle && <span className="compact-meta">Conflicto circular</span>}
                      </div>
                      <div className="subject-meta">
                        <span>Carga horaria: {cls.hours ?? '-'}</span>
                        <span>Correlativas: {selectedPrereqs.length}</span>
                        <span>Opciones: {stats.optionCount}</span>
                        <span>Bloques: {stats.blockCount}</span>
                      </div>
                      {stats.preview && <div className="subject-preview">{stats.preview}</div>}
                      {prereqNames.length > 0 && (
                        <div className="subject-chip-row">
                          {prereqNames.map((name) => (
                            <span key={`${cls.id}-${name}`} className="subject-chip">{name}</span>
                          ))}
                          {selectedPrereqs.length > 3 && <span className="subject-chip">+{selectedPrereqs.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <span className="subject-caret">{isExpanded ? '▾' : '▸'}</span>
                  </button>

                  {isExpanded && (
                    <div className="subject-editor">
                      <div className="field-row three">
                        <div>
                          <label>ID</label>
                          <input
                            className="input"
                            type="number"
                            value={cls.id}
                            onChange={(event) => setClassField(cls.id, 'id', Number(event.target.value))}
                          />
                        </div>
                        <div>
                          <label>Nombre</label>
                          <input
                            className="input"
                            value={cls.name}
                            onChange={(event) => setClassField(cls.id, 'name', event.target.value)}
                          />
                        </div>
                        <div>
                          <label>Carga horaria (hs)</label>
                          <input
                            className="input"
                            type="number"
                            value={cls.hours ?? ''}
                            onChange={(event) => setClassField(cls.id, 'hours', event.target.value === '' ? null : Number(event.target.value))}
                          />
                        </div>
                      </div>

                      <div className="editor-section">
                        <div className="editor-section-title">Correlativas</div>
                        <p className="helper-text">Escribi para buscar y seleccionar.</p>
                        <div className="prereq-chip-list">
                          {selectedPrereqs.length === 0 && <span className="mono">Sin correlativas</span>}
                          {selectedPrereqs.map((id) => (
                            <span key={`${cls.id}-pre-${id}`} className="subject-chip removable">
                              {classMap.get(id)?.name || `#${id}`}
                              <button type="button" className="icon-button" onClick={() => removePrerequisite(cls.id, id)} title="Quitar correlativa">×</button>
                            </span>
                          ))}
                        </div>
                        <div className="prereq-combobox">
                          <input
                            className="input"
                            placeholder="Buscar materia..."
                            value={prereqQuery}
                            onFocus={() => setActivePrereqEditor(cls.id)}
                            onBlur={() => setTimeout(() => setActivePrereqEditor((current) => (current === cls.id ? null : current)), 120)}
                            onChange={(event) => updatePrereqQuery(cls.id, event.target.value)}
                            onKeyDown={(event) => handlePrereqInputKeyDown(event, cls.id, prereqSuggestions, prereqQuery, selectedPrereqs)}
                          />
                          {activePrereqEditor === cls.id && (prereqSuggestions.length > 0 || canQuickCreate) && (
                            <div className="prereq-menu">
                              {prereqSuggestions.map((candidate) => (
                                <button
                                  key={`suggest-${cls.id}-${candidate.id}`}
                                  type="button"
                                  className="prereq-option"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => addPrerequisite(cls.id, candidate.id)}
                                >
                                  {candidate.name}
                                  <span className="mono">#{candidate.id}</span>
                                </button>
                              ))}
                              {canQuickCreate && (
                                <button
                                  type="button"
                                  className="prereq-option create"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => quickCreatePrerequisite(cls.id, prereqQuery)}
                                >
                                  Crear "{prereqQuery.trim()}" como nueva materia
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="editor-section">
                        <div className="editor-section-title">Opciones de horario</div>
                        <div className="action-row" style={{ marginTop: '0.35rem' }}>
                          <button className="primary" type="button" onClick={() => addOption(cls.id)}>Agregar opcion</button>
                        </div>

                        {(cls.scheduleOptions || []).map((option, optionIndex) => (
                          <div key={`option-${cls.id}-${optionIndex}`} className="class-chip" style={{ marginTop: '0.55rem' }}>
                            <div className="action-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>Opcion {optionIndex + 1}</strong>
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => removeOption(cls.id, optionIndex)}
                                disabled={(cls.scheduleOptions || []).length <= 1}
                                title="Quitar opcion"
                              >
                                ×
                              </button>
                            </div>

                            <div className="editor-section" style={{ marginTop: '0.55rem' }}>
                              <div className="editor-section-title">Bloques</div>
                              {(option.schedule || []).map((block, blockIndex) => (
                                <div key={`block-${cls.id}-${optionIndex}-${blockIndex}`} className="block-row">
                                  <select
                                    className="select"
                                    value={block.day}
                                    onChange={(event) => setBlockField(cls.id, optionIndex, blockIndex, 'day', event.target.value)}
                                  >
                                    {DAY_OPTIONS.map((day) => (
                                      <option value={day} key={`${cls.id}-${optionIndex}-${blockIndex}-${day}`}>{day}</option>
                                    ))}
                                  </select>
                                  <input
                                    className="input"
                                    value={block.startTime}
                                    onChange={(event) => setBlockField(cls.id, optionIndex, blockIndex, 'startTime', event.target.value)}
                                    placeholder="Inicio"
                                  />
                                  <input
                                    className="input"
                                    value={block.endTime}
                                    onChange={(event) => setBlockField(cls.id, optionIndex, blockIndex, 'endTime', event.target.value)}
                                    placeholder="Fin"
                                  />
                                  <button
                                    className="icon-button"
                                    type="button"
                                    onClick={() => removeBlock(cls.id, optionIndex, blockIndex)}
                                    disabled={(option.schedule || []).length <= 1}
                                    title="Quitar bloque"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <button className="ghost" type="button" onClick={() => addBlock(cls.id, optionIndex)}>Agregar bloque</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="action-row" style={{ justifyContent: 'flex-end' }}>
                        <button className="danger" type="button" onClick={() => removeClass(cls.id)}>Eliminar materia</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
