# Webapp Stage 1 (Next.js)

This folder contains the new standalone webapp built with Next.js.

## What is included

- Mobile-first planner UI for:
  - curriculum selection/import
  - passed classes selection
  - optional QoL constraints/preferences
  - generating optimized plans
- `Curriculum Studio` page to create/edit/import/export curriculums.
- API route (`/api/solve`) wired to algorithm stage entrypoint:
  - `src/lib/algorithm/entrypoint.js`

## Run

```bash
cd webapp
npm install
npm run dev
```

## Curriculum format

The app supports two input styles:

1. Raw class array (legacy)
2. Envelope format (`schedule-curriculum-v1`):

```json
{
  "formatVersion": "schedule-curriculum-v1",
  "metadata": {
    "id": "mecatronica-2025C2",
    "name": "Ingenieria Mecatronica 2025 C2",
    "institution": "UNLaM",
    "degree": "Ingenieria Mecatronica",
    "updatedAt": "2026-02-06T00:00:00.000Z"
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
