'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import CatalogPickerModal from '@/components/CatalogPickerModal.jsx';
import { parseCatalogPayload } from '@/lib/catalog-format.js';
import { DAY_OPTIONS } from '@/lib/defaults.js';
import { buildAutoCurriculumId, createEmptyCurriculumEnvelope, parseCurriculumPayload, serializeCurriculumEnvelope } from '@/lib/curriculum-format.js';

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

function toExportFileName(name) {
  const safeName = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ');

  return `${safeName || 'Plan de estudio'}.json`;
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

function ActionIcon({ name }) {
  if (name === 'catalog') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v13h-2V6a1 1 0 0 0-1-1H6v14h8v2H6a2 2 0 0 1-2-2V5z" fill="currentColor" /></svg>;
  }
  if (name === 'json') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zm0 2.5L16.5 8H14V5.5zM9 12h6v2H9v-2zm0 4h6v2H9v-2z" fill="currentColor" /></svg>;
  }
  if (name === 'search') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0-2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2z" fill="currentColor" /></svg>;
  }
  if (name === 'file') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 1.5V8h3.5L13 4.5zM8 12h8v2H8v-2z" fill="currentColor" /></svg>;
  }
  if (name === 'text') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" fill="currentColor" /></svg>;
  }
  if (name === 'planner') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h7V3H3v9h2V5zm14 14h-7v2h9v-9h-2v7zM8 17l10-10-1.4-1.4-10 10L8 17z" fill="currentColor" /></svg>;
  }
  if (name === 'more') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="currentColor" /></svg>;
  }
  if (name === 'download') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v8h3l-4 4-4-4h3V4zm-6 13h14v3H5v-3z" fill="currentColor" /></svg>;
  }
  if (name === 'plus') {
    return <svg className="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" fill="currentColor" /></svg>;
  }
  return null;
}

export default function CurriculumStudio() {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef(null);
  const actionsMenuRef = useRef(null);

  const [catalog, setCatalog] = useState([]);
  const [catalogUniversities, setCatalogUniversities] = useState([]);
  const [catalogFaculties, setCatalogFaculties] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [envelope, setEnvelope] = useState(createEmptyCurriculumEnvelope());
  const [importText, setImportText] = useState('');
  const [importedFileName, setImportedFileName] = useState('');
  const [sourceMode, setSourceMode] = useState('catalog');
  const [jsonInputMode, setJsonInputMode] = useState('file');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [lastExportedFingerprint, setLastExportedFingerprint] = useState(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

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
        setCatalogUniversities(parsedCatalog.universities);
        setCatalogFaculties(parsedCatalog.faculties);
      } catch (loadError) {
        setError(`No se pudo cargar catalogo: ${loadError.message}`);
      }
    }

    loadCatalog();
  }, []);

  useEffect(() => {
    if (!showActionsMenu) {
      return;
    }

    function onPointerDown(event) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    }

    function onEscape(event) {
      if (event.key === 'Escape') {
        setShowActionsMenu(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [showActionsMenu]);

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

  const autoMetadataId = useMemo(
    () => buildAutoCurriculumId(envelope.metadata, classes),
    [envelope.metadata, classes]
  );

  const selectedCatalogPlan = useMemo(
    () => catalog.find((entry) => entry.id === selectedCatalogId) || null,
    [catalog, selectedCatalogId]
  );

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
          institution: [item.university?.shortName || item.university?.name, item.faculty?.shortName || item.faculty?.name]
            .filter(Boolean)
            .join(' · ') || 'Universidad'
        },
        classes: json
      });
      setEnvelope(parsed);
      setExpandedClassIds(new Set(parsed.classes[0] ? [parsed.classes[0].id] : []));
      setSelectedCatalogId(item.id);
      setSourceMode('catalog');
      setLastExportedFingerprint(null);
      setNotice(`Cargado: ${parsed.metadata.name}`);
    } catch (loadError) {
      setErrorSafe(`Error cargando plan de estudio: ${loadError.message}`);
    }
  }

  function handleSelectCatalogPlan(item) {
    loadBuiltIn(item);
    setCatalogModalOpen(false);
  }

  function applyImportedPayload(payload, source) {
    const parsed = parseCurriculumPayload(payload);
    if (parsed.classes.length === 0) {
      throw new Error('No hay materias validas en el JSON.');
    }

    setEnvelope(parsed);
    setExpandedClassIds(new Set(parsed.classes[0] ? [parsed.classes[0].id] : []));
    setLastExportedFingerprint(null);
    clearMessages();
    setNotice(`Importado desde ${source}: ${parsed.metadata.name}`);
  }

  function importFromText() {
    try {
      applyImportedPayload(JSON.parse(importText), 'texto');
      setSourceMode('json');
      setJsonInputMode('text');
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
        setSourceMode('json');
        setJsonInputMode('file');
      } catch (importError) {
        setErrorSafe(`Importacion invalida: ${importError.message}`);
      }
    };
    reader.readAsText(file);
  }

  function exportCurriculum() {
    const serialized = serializeCurriculumEnvelope(envelope);
    const filename = toExportFileName(serialized.metadata.name);
    toDownloadFile(JSON.stringify(serialized, null, 2), filename);
    setLastExportedFingerprint(buildDraftFingerprint(envelope));
    setShowActionsMenu(false);
    setNotice(`Exportado ${filename}`);
  }

  function buildDraftFingerprint(curriculumEnvelope) {
    const normalized = parseCurriculumPayload(curriculumEnvelope);
    return JSON.stringify({
      metadata: {
        id: normalized.metadata.id,
        name: normalized.metadata.name,
        institution: normalized.metadata.institution,
        degree: normalized.metadata.degree
      },
      classes: normalized.classes
    });
  }

  function copyForPlanner() {
    const serialized = serializeCurriculumEnvelope(envelope);
    const currentFingerprint = buildDraftFingerprint(envelope);
    const wasExportedCurrentVersion = lastExportedFingerprint === currentFingerprint;

    if (!wasExportedCurrentVersion) {
      const shouldDownload = window.confirm(
        'Todavia no exportaste esta version del plan. ¿Querés descargar el JSON antes de ir al planificador?'
      );
      if (shouldDownload) {
        const filename = toExportFileName(serialized.metadata.name);
        toDownloadFile(JSON.stringify(serialized, null, 2), filename);
        setLastExportedFingerprint(currentFingerprint);
      }
    }

    localStorage.setItem('schedule.curriculumDraft', JSON.stringify(serialized));
    setNotice('Plan de estudio guardado para abrir en el planificador.');
    router.push('/');
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
        <section className="surface panel panel-overflow-visible">
          <h2>Paso 1. Fuente del plan</h2>
          <p>Elige una via para cargar el plan: catalogo o JSON personalizado.</p>

          <div className="source-mode-switch" style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              className={`source-mode-chip ${sourceMode === 'catalog' ? 'active' : ''} button-with-icon`}
              onClick={() => setSourceMode('catalog')}
            >
              <ActionIcon name="catalog" />
              Usar catalogo
            </button>
            <button
              type="button"
              className={`source-mode-chip ${sourceMode === 'json' ? 'active' : ''} button-with-icon`}
              onClick={() => setSourceMode('json')}
            >
              <ActionIcon name="json" />
              Importar JSON
            </button>
          </div>

          {sourceMode === 'catalog' && (
            <article className="source-card" style={{ marginTop: '0.8rem' }}>
              <h3>Desde catalogo</h3>
              <button
                type="button"
                className="ghost button-with-icon"
                onClick={() => setCatalogModalOpen(true)}
                disabled={catalog.length === 0}
              >
                <ActionIcon name="search" />
                Ver planes
              </button>
              {selectedCatalogPlan && (
                <div className="catalog-selection-summary">
                  <strong>{selectedCatalogPlan.name}</strong>
                  <div className="mono">{selectedCatalogPlan.university?.name || 'Universidad no especificada'}</div>
                  <div className="mono">{selectedCatalogPlan.faculty?.name || 'Facultad no especificada'}</div>
                </div>
              )}
            </article>
          )}

          {sourceMode === 'json' && (
            <article className="source-card" style={{ marginTop: '0.8rem' }}>
              <h3>Importacion JSON</h3>
              <div className="source-mode-switch">
                <button
                  type="button"
                  className={`source-mode-chip ${jsonInputMode === 'file' ? 'active' : ''} button-with-icon`}
                  onClick={() => setJsonInputMode('file')}
                >
                  <ActionIcon name="file" />
                  Desde archivo
                </button>
                <button
                  type="button"
                  className={`source-mode-chip ${jsonInputMode === 'text' ? 'active' : ''} button-with-icon`}
                  onClick={() => setJsonInputMode('text')}
                >
                  <ActionIcon name="text" />
                  Pegar texto
                </button>
              </div>

              {jsonInputMode === 'file' && (
                <>
                  <p className="helper-text">Arrastra un archivo o abre el selector.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={importFromFile}
                    style={{ display: 'none' }}
                  />
                  <button className="ghost button-with-icon" type="button" onClick={() => fileInputRef.current?.click()}>
                    <ActionIcon name="file" />
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
                </>
              )}

              {jsonInputMode === 'text' && (
                <div className="soft-panel" style={{ marginTop: '0.45rem' }}>
                  <label>Importar desde texto JSON</label>
                  <textarea
                    className="textarea"
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    placeholder="Pega un plan de estudio en formato JSON"
                  />
                  <div style={{ marginTop: '0.55rem' }}>
                    <button className="ghost button-with-icon" onClick={importFromText} type="button">
                      <ActionIcon name="json" />
                      Importar texto
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}

          <div className="studio-primary-actions">
            <button className="primary button-with-icon" onClick={copyForPlanner} type="button">
              <ActionIcon name="planner" />
              Usar en planificador
            </button>
            <div className="actions-menu" ref={actionsMenuRef}>
              <button
                className="actions-menu-trigger button-with-icon"
                type="button"
                aria-label="Mas acciones"
                aria-expanded={showActionsMenu}
                onClick={() => setShowActionsMenu((prev) => !prev)}
              >
                <ActionIcon name="more" />
                Mas acciones
              </button>
              {showActionsMenu && (
                <div className="actions-menu-list">
                  <button className="ghost button-with-icon" onClick={exportCurriculum} type="button">
                    <ActionIcon name="download" />
                    Exportar JSON
                  </button>
                <button
                  className="ghost button-with-icon"
                  onClick={() => {
                    setEnvelope(createEmptyCurriculumEnvelope());
                    setExpandedClassIds(new Set());
                    setSelectedCatalogId('');
                    setImportText('');
                    setImportedFileName('');
                    setSourceMode('catalog');
                    setJsonInputMode('file');
                    setLastExportedFingerprint(null);
                    setShowActionsMenu(false);
                    setNotice('Editor reiniciado.');
                  }}
                  type="button"
                >
                  <ActionIcon name="plus" />
                  Nuevo plan
                </button>
              </div>
              )}
            </div>
          </div>

          {notice && <div className="notice ok">{notice}</div>}
          {error && <div className="notice error">{error}</div>}
        </section>

        <section className="surface panel">
          <h2>Paso 2. Metadata</h2>
          <p className="helper-text">
            El ID se genera automaticamente para evitar colisiones. El archivo exportado usa el nombre del plan.
          </p>
          <div className="field-row two metadata-grid" style={{ marginTop: '0.65rem' }}>
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
          <div className="compact-meta" style={{ marginTop: '0.65rem' }}>
            ID automatico: <span className="mono">{autoMetadataId}</span>
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
