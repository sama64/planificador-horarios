# Algorithm Stage 1: Scaffolding, Validation, and Measured Baseline

## Scope delivered

This stage intentionally excludes UI/webapp work and focuses on algorithm engineering in JavaScript:

- canonical scheduling model + graph/conflict preprocessing
- strict validator for hard constraints
- two solver implementations behind comparable interfaces
- deterministic tests (unit + randomized oracle comparison)
- benchmark runner to track correctness/performance over time

## Problem formalization

Input classes define:

- a prerequisite DAG (must schedule strictly after prerequisites)
- one required option per class (chosen from alternatives)
- each option as weekly time blocks

Optimization target:

- minimize number of periods needed to schedule all classes

Hard constraints checked by the validator:

- prerequisite order
- valid option selection
- no overlap in same period
- one assignment per class
- period count consistency

## Implemented solver approaches

1. `oracleExact` (`src/lib/algorithm/solvers/oracleExact.js`)
- exact branch-and-bound by period horizon
- guaranteed optimal when it finishes
- used as correctness oracle on small instances

2. `criticalPathGreedy` (`src/lib/algorithm/solvers/criticalPathGreedy.js`)
- scalable heuristic
- period-by-period packing guided by prerequisite criticality
- used for larger datasets and performance baselines

## Test and benchmark harness

Tests (`npm run test:algorithm`):

- `test/algorithm/validator.test.js`
- `test/algorithm/oracleExact.test.js`
- `test/algorithm/candidate.test.js`

Benchmark (`npm run bench:algorithm`):

- small random instances: candidate vs oracle
- synthetic scaling: candidate on class counts 10..49
- real dataset: `mecatronica-2025C2.json`

## Measured baseline (run on Feb 6, 2026)

Small instance optimality (20 random instances, 10 classes):

- candidate runtime mean: `0.25ms`
- oracle runtime mean: `0.42ms`
- candidate-oracle gap: mean `0.00`, max `0`

Synthetic scale (candidate):

- 49-class runtime mean: `1.95ms`, p95 `3.01ms`, max `10.37ms`

Real dataset (`mecatronica-2025C2.json`, 49 classes):

- candidate runtime mean: `0.71ms`
- candidate periods: `11` (stable across runs)
- known prerequisite lower bound from graph depth: `10`

Interpretation:

- correctness scaffolding is in place and passing
- current heuristic is fast and valid
- on the real dataset, solution quality is close to theoretical lower bound, but not yet proven optimal

## Stage 2 algorithm plan

Primary approach to implement next:

1. Hybrid exact-first scheduler
- use `criticalPathGreedy` to get a fast upper bound
- run branch-and-bound feasibility checks for horizon `H` starting from lower bound
- keep best feasible schedule anytime; stop on timeout with best-known solution

2. Performance upgrades for exact search
- bitset conflict checks
- stronger variable ordering (MRV + critical-path tie-break)
- dominance/pruning by partial state signatures

3. Validation gate
- for all small/medium randomized instances, compare against `oracleExact`
- for large instances, enforce validator correctness and runtime targets

Success criteria for Stage 2:

- still always validator-correct
- materially reduce cases where candidate is above lower bound
- preserve practical runtime on 49-class real datasets
