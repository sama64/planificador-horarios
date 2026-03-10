# Planificador Horarios (Next.js)

Repositorio principal del planificador academico, ahora ejecutando la app Next.js desde la raiz.

## What is included

- Mobile-first planner UI for:
  - curriculum selection/import
  - passed classes selection
  - optional QoL constraints/preferences
  - generating optimized plans
- `Curriculum Studio` page to create/edit/import/export curriculums.
- API route (`/api/solve`) wired to algorithm stage entrypoint:
  - `src/lib/algorithm/entrypoint.js`

## Current scheduling behavior

The default scheduler is the MIP-based solver exposed through `solveScheduleWithConstraints`.

Its priority order is:

1. Minimize the total number of periods.
2. Within that optimal period count, rebalance the schedule so earlier curriculum classes stay as early as feasible and period load is more even.

Current defaults and guarantees:

- default maximum of `6` classes per period unless the client sends another value
- strict prerequisite ordering
- no same-period time conflicts
- optional maximum weekly hours per period
- optional hard filters (`forbiddenDays`, `keepFreeDays`, hard time preference, hard Saturday avoidance)
- optional soft penalties (time preference, Saturday avoidance)

The solver response metadata can include:

- `optimality`
- `delegatedSolver`
- `balancedScheduleApplied`
- `balanceProfile`
- `appliedConstraints`

## Run

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test:algorithm
npm run bench:algorithm
```

## Curriculum format

The app supports two input styles:

1. Raw class array (legacy)
2. Envelope format (`schedule-curriculum-v1`):

```json
{
  "formatVersion": "schedule-curriculum-v1",
  "metadata": {
    "id": "mecatronica-2026C1",
    "name": "Ingenieria Mecatronica 2026 C1",
    "institution": "UNLaM",
    "degree": "Ingenieria Mecatronica",
    "updatedAt": "2026-03-10T00:00:00.000Z"
  },
  "classes": [
    {
      "id": 1,
      "name": "Materia",
      "hours": 128,
      "prerequisites": [],
      "scheduleOptions": [
        {
          "schedule": [
            { "day": "Lunes", "startTime": "08:00", "endTime": "10:00" }
          ]
        }
      ]
    }
  ]
}
```

## Stage plan

- Stage 1: foundation + usable end-to-end flow (this delivery).
- Stage 2: UX polish, validations, richer result views and conflict explanation.
- Stage 3: deployment packaging and curriculum sharing workflow improvements.
