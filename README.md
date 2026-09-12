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

## Agent CLI

The local CLI exposes the bundled catalogs and solver as structured JSON. It
defaults to `mecatronica-2026C2` when no curriculum is specified.

```bash
npm run agent:planner -- catalog
npm run agent:planner -- curriculum mecatronica-2026C2
npm run agent:planner -- solve --json '{"passedClasses":[1,"Introducción a la Ingeniería"],"constraints":{"avoidSaturdays":true}}'
printf '%s' '{"passedClasses":[1,2]}' | npm run agent:planner -- solve
```

`passedClasses` accepts curriculum IDs or exact class names (case and accents
are ignored). The regular solver constraints remain available under
`constraints`, and solver tuning remains available under `solverOptions`. The
CLI uses a 15-second solver timeout by default; this can be overridden with
`solverOptions.timeoutMs`.

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
