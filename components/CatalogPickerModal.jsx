'use client';

import { useEffect, useMemo, useState } from 'react';

function formatDateLabel(value) {
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

function toTimeForSort(value) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export default function CatalogPickerModal({
  open,
  plans,
  universities,
  faculties,
  selectedPlanId,
  onClose,
  onSelectPlan
}) {
  const [search, setSearch] = useState('');
  const [activeUniversityId, setActiveUniversityId] = useState('all');
  const [activeFacultyId, setActiveFacultyId] = useState('all');

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSearch('');
    setActiveUniversityId('all');
    setActiveFacultyId('all');
  }, [open]);

  const availableFaculties = useMemo(() => {
    return faculties
      .filter((faculty) => activeUniversityId === 'all' || faculty.universityId === activeUniversityId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [activeUniversityId, faculties]);

  const filteredPlans = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return plans
      .filter((plan) => {
        if (activeUniversityId !== 'all' && plan.university.id !== activeUniversityId) {
          return false;
        }
        if (activeFacultyId !== 'all' && plan.faculty?.id !== activeFacultyId) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        const text = [
          plan.name,
          plan.career,
          plan.id,
          plan.university.name,
          plan.university.shortName,
          plan.faculty?.name || '',
          plan.faculty?.shortName || ''
        ]
          .join(' ')
          .toLowerCase();

        return text.includes(normalizedSearch);
      })
      .sort((a, b) => toTimeForSort(b.lastUpdated) - toTimeForSort(a.lastUpdated));
  }, [activeFacultyId, activeUniversityId, plans, search]);

  if (!open) {
    return null;
  }

  return (
    <div className="catalog-modal-overlay" onClick={onClose} role="presentation">
      <section className="catalog-modal surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="catalog-modal-header">
          <h3>Seleccionar plan de estudio</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="catalog-modal-search">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar carrera, universidad o plan..."
          />
        </div>

        <div className="catalog-university-strip">
          <button
            type="button"
            className={`catalog-university-chip ${activeUniversityId === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveUniversityId('all');
              setActiveFacultyId('all');
            }}
          >
            <span className="catalog-university-logo">TOD</span>
            <span>Todas</span>
          </button>
          {universities.map((university) => (
            <button
              type="button"
              key={university.id}
              className={`catalog-university-chip ${activeUniversityId === university.id ? 'active' : ''}`}
              onClick={() => {
                setActiveUniversityId(university.id);
                setActiveFacultyId('all');
              }}
            >
              <span
                className={`catalog-university-logo ${university.logoUrl ? 'image' : ''}`}
                style={university.logoUrl ? { backgroundImage: `url(${university.logoUrl})` } : undefined}
                aria-label={university.shortName || university.name}
              >
                {university.logoUrl ? '' : university.logoText}
              </span>
              <span>{university.shortName || university.name}</span>
            </button>
          ))}
        </div>

        <div className="catalog-faculty-strip">
          <button
            type="button"
            className={`catalog-faculty-chip ${activeFacultyId === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFacultyId('all')}
          >
            Todas las facultades
          </button>
          {availableFaculties.map((faculty) => (
            <button
              type="button"
              key={faculty.id}
              className={`catalog-faculty-chip ${activeFacultyId === faculty.id ? 'active' : ''}`}
              onClick={() => setActiveFacultyId(faculty.id)}
            >
              {faculty.shortName || faculty.name}
            </button>
          ))}
        </div>

        <div className="catalog-plan-list">
          {filteredPlans.map((plan) => (
            <article
              key={plan.id}
              className={`catalog-plan-card ${selectedPlanId === plan.id ? 'active' : ''}`}
            >
              <div className="catalog-plan-top">
                <strong>{plan.name}</strong>
                <span className="compact-meta">{plan.university.shortName}</span>
              </div>

              <div className="catalog-plan-meta">
                <span>{plan.career || 'Carrera no especificada'}</span>
                <span>{plan.faculty?.name || 'Facultad no especificada'}</span>
                <span>Ultima actualizacion: {formatDateLabel(plan.lastUpdated)}</span>
              </div>

              <div className="action-row">
                <button type="button" className="primary" onClick={() => onSelectPlan(plan)}>
                  Elegir plan
                </button>
              </div>
            </article>
          ))}

          {filteredPlans.length === 0 && (
            <div className="notice warn" style={{ marginTop: 0 }}>
              No hay planes que coincidan con la busqueda actual.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
