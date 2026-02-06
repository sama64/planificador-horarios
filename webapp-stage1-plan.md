# Webapp Roadmap (Next.js)

## Technical choices

- Framework: Next.js App Router (React 19).
- Architecture: standalone webapp in `webapp/`, algorithm core reused from `src/lib/algorithm`.
- Solver access: server route (`/api/solve`) to keep heavy optimization on server side.
- Data format: `schedule-curriculum-v1` envelope + legacy array compatibility.

## Stage 1 (implemented)

- End-to-end usable flow:
  - choose built-in curriculum
  - import curriculum JSON
  - pick passed classes
  - set optional constraints/preferences
  - generate optimized plan and read it by periods
- Mobile-first layout with desktop adaptation.
- Curriculum Studio (basic but functional):
  - create/edit classes
  - edit schedule options and prerequisite IDs
  - import/export JSON
  - send draft directly to planner via local storage handoff

## Stage 2 (next)

- UX and safety improvements:
  - stronger client-side validations in studio (time formats, duplicate IDs, invalid prereq references)
  - richer solve error messages with actionable hints
  - improved results visualization (weekly calendar heatmap + conflicts explanation)
  - autosave drafts and undo/redo in studio

## Stage 3

- Distribution and curriculum sharing:
  - shareable links/files with metadata and checksums
  - curriculum diff view (changes between versions)
  - import wizard with migration hints for old formats

## Current quality gate

- Webapp build: `cd webapp && npm run build` (passes)
- Algorithm regressions: `npm run test:algorithm` (21/21 passes)
