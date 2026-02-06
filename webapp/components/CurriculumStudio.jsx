'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { createEmptyCurriculumEnvelope, parseCurriculumPayload, serializeCurriculumEnvelope } from '@/lib/curriculum-format.js';

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

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/curriculums/index.json');
        const data = await response.json();
        setCatalog(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(`No se pudo cargar catalogo: ${loadError.message}`);
      }
    }

    loadCatalog();
  }, []);

  const classes = envelope.classes || [];

  const nextClassId = useMemo(() => {
    let maxId = 0;
    for (const cls of classes) {
      maxId = Math.max(maxId, Number(cls.id) || 0);
    }
    return maxId + 1;
  }, [classes]);

  async function loadBuiltIn(item) {
    try {
      setError('');
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
      setNotice(`Cargado: ${parsed.metadata.name}`);
    } catch (loadError) {
      setError(`Error cargando plan de estudio: ${loadError.message}`);
    }
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

  function setClassValue(index, field, value) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[index][field] = value;
      return next;
    });
  }

  function setPrerequisitesFromString(index, value) {
    const parsed = value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry));

    setClassValue(index, 'prerequisites', [...new Set(parsed)]);
  }

  function setBlockValue(classIndex, optionIndex, blockIndex, field, value) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[classIndex].scheduleOptions[optionIndex].schedule[blockIndex][field] = value;
      return next;
    });
  }

  function addClass() {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes.push(createEmptyClass(nextClassId));
      return next;
    });
  }

  function removeClass(index) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes.splice(index, 1);
      return next;
    });
  }

  function addOption(classIndex) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[classIndex].scheduleOptions.push({
        schedule: [
          {
            day: 'Lunes',
            startTime: '08:00',
            endTime: '10:00'
          }
        ]
      });
      return next;
    });
  }

  function removeOption(classIndex, optionIndex) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[classIndex].scheduleOptions.splice(optionIndex, 1);
      return next;
    });
  }

  function addBlock(classIndex, optionIndex) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[classIndex].scheduleOptions[optionIndex].schedule.push({
        day: 'Lunes',
        startTime: '08:00',
        endTime: '10:00'
      });
      return next;
    });
  }

  function removeBlock(classIndex, optionIndex, blockIndex) {
    setEnvelope((prev) => {
      const next = cloneEnvelope(prev);
      next.classes[classIndex].scheduleOptions[optionIndex].schedule.splice(blockIndex, 1);
      return next;
    });
  }

  function importFromText() {
    try {
      applyImportedPayload(JSON.parse(importText), 'texto');
    } catch (importError) {
      setError(`Importacion invalida: ${importError.message}`);
    }
  }

  function applyImportedPayload(payload, source) {
    const parsed = parseCurriculumPayload(payload);
    if (parsed.classes.length === 0) {
      throw new Error('No hay materias validas en el JSON.');
    }

    setEnvelope(parsed);
    setError('');
    setNotice(`Importado desde ${source}: ${parsed.metadata.name}`);
  }

  function importFromFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
        setImportedFileName(file.name);
        try {
          applyImportedPayload(JSON.parse(reader.result), `archivo ${file.name}`);
        } catch (importError) {
          setError(`Importacion invalida: ${importError.message}`);
        }
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
            ID recomendado: usa minusculas y guiones. Ejemplo: <span className="mono">mecatronica-2025-c2</span>
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
            <button className="primary" onClick={addClass} type="button">Agregar materia</button>
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

          <div className="stack" style={{ marginTop: '0.8rem' }}>
            {classes.map((cls, classIndex) => (
              <article className="period-card" key={`class-${classIndex}-${cls.id}`}>
                <div className="field-row three">
                  <div>
                    <label>ID</label>
                    <input
                      className="input"
                      type="number"
                      value={cls.id}
                      onChange={(event) => setClassValue(classIndex, 'id', Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <label>Nombre</label>
                    <input
                      className="input"
                      value={cls.name}
                      onChange={(event) => setClassValue(classIndex, 'name', event.target.value)}
                    />
                  </div>
                  <div>
                    <label>Horas</label>
                    <input
                      className="input"
                      type="number"
                      value={cls.hours ?? ''}
                      onChange={(event) => setClassValue(classIndex, 'hours', event.target.value === '' ? null : Number(event.target.value))}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.55rem' }}>
                  <label>Correlativas (IDs separados por coma)</label>
                  <input
                    className="input"
                    value={(cls.prerequisites || []).join(', ')}
                    onChange={(event) => setPrerequisitesFromString(classIndex, event.target.value)}
                  />
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9rem' }}>Opciones de horario ({cls.scheduleOptions.length})</strong>
                  <button className="ghost" type="button" onClick={() => addOption(classIndex)}>Agregar opcion</button>
                </div>

                {cls.scheduleOptions.map((option, optionIndex) => (
                  <div key={`option-${classIndex}-${optionIndex}`} className="class-chip" style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Opcion {optionIndex + 1}</strong>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => removeOption(classIndex, optionIndex)}
                        disabled={cls.scheduleOptions.length <= 1}
                      >
                        Quitar opcion
                      </button>
                    </div>

                    {option.schedule.map((block, blockIndex) => (
                      <div key={`block-${classIndex}-${optionIndex}-${blockIndex}`} className="field-row three" style={{ marginTop: '0.45rem' }}>
                        <div>
                          <label>Dia</label>
                          <input
                            className="input"
                            value={block.day}
                            onChange={(event) => setBlockValue(classIndex, optionIndex, blockIndex, 'day', event.target.value)}
                          />
                        </div>
                        <div>
                          <label>Inicio</label>
                          <input
                            className="input"
                            value={block.startTime}
                            onChange={(event) => setBlockValue(classIndex, optionIndex, blockIndex, 'startTime', event.target.value)}
                          />
                        </div>
                        <div>
                          <label>Fin</label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input
                              className="input"
                              value={block.endTime}
                              onChange={(event) => setBlockValue(classIndex, optionIndex, blockIndex, 'endTime', event.target.value)}
                            />
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => removeBlock(classIndex, optionIndex, blockIndex)}
                              disabled={option.schedule.length <= 1}
                            >
                              -
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button className="ghost" style={{ marginTop: '0.45rem' }} type="button" onClick={() => addBlock(classIndex, optionIndex)}>
                      Agregar bloque
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: '0.7rem' }}>
                  <button className="warn" type="button" onClick={() => removeClass(classIndex)}>Eliminar materia</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
