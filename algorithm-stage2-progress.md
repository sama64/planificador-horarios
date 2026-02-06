# Algorithm Stage 2 Progress (Period-Minimization Priority)

## Objective update

Primary optimization objective is now explicit:

- Minimize total periods first
- Keep runtime bounded (`< 5s` budget)

## New solver

Added `solveWithMipMinPeriods` in:

- `src/lib/algorithm/solvers/mipMinPeriods.js`

Approach:

1. Use greedy solver to get a feasible upper bound.
2. Build a MIP feasibility model for each horizon from lower bound upward.
3. First feasible horizon is optimal (because horizons are checked in increasing order).
4. If budget expires, return best known feasible schedule with `feasible_not_proven` status.

Model constraints:

- one assignment per class
- strict prerequisite ordering
- no same-period time conflicts
- optional max classes per period
- optional max weekly hours per period

## UI-facing entrypoint

Added `solveScheduleWithConstraints` in:

- `src/lib/algorithm/entrypoint.js`

This is the recommended API for the next webapp stage. It supports:

- `passedClassIds`
- `forbiddenDays`
- `keepFreeDays`
- `avoidSaturdays` with mode `soft|hard`
- `timePreference` (`morning|afternoon|evening|night|afternoon_or_night`) with mode `soft|hard`
- `maxWeeklyHoursPerPeriod`
- `maxClassesPerPeriod`
- optional custom `penaltyWeights`

Behavior:

- hard constraints are filtered before solving
- soft preferences are encoded as MIP penalties
- output includes `optionIndex` (original option index) and `filteredOptionIndex`
- output meta includes applied constraints and solver optimality status

## Why this is better for your priority

- It is exact on period minimization whenever solved within timeout.
- On the provided 49-class dataset, it proves optimality quickly.

## Current benchmark snapshot (Feb 6, 2026)

Command: `npm run bench:algorithm`

Real dataset `mecatronica-2025C2.json`:

- `greedy`: `11` periods, mean runtime `0.58ms`
- `hybrid`: `11` periods, mean runtime `121.06ms`
- `mipMinPeriods`: `11` periods, mean runtime `5.16ms`
- MIP optimality status: `optimal_proven`
- Bound check: lower `10`, upper `11`, horizon `10` proven infeasible

Small random instances vs oracle:

- MIP exact matches: `20/20`
- MIP gap vs oracle: max `0`

## Test status

Command: `npm run test:algorithm`

- Result: `21/21` tests passing.
- Includes dedicated test proving mecatronica optimum under 5s:
  - `test/algorithm/mipMinPeriods.test.js`
- Includes entrypoint constraint tests:
  - `test/algorithm/entrypoint.test.js`

## Recommendation

For algorithm-first backend stage, use `solveWithMipMinPeriods` as default scheduler.

- It directly optimizes your highest-priority metric (fewest periods)
- It stays far below the `<5s` runtime budget on current real data
