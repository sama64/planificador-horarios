# Algorithm Stage 2 Progress (Period Minimization + Fixed-Horizon Balancing)

## Objective update

Primary optimization objective is now explicit:

- Minimize total periods first
- Then improve balance without increasing the number of periods
- Keep runtime bounded (`< 5s` budget on current datasets)

## New solver

Added `solveWithMipMinPeriods` in:

- `src/lib/algorithm/solvers/mipMinPeriods.js`

Approach:

1. Use greedy solver to get a feasible upper bound.
2. Build a MIP feasibility model for each horizon from lower bound upward.
3. First feasible horizon is optimal (because horizons are checked in increasing order).
4. Re-solve the optimal horizon with a secondary balancing objective.
5. If budget expires, return best known feasible schedule with `feasible_not_proven` status.

Model constraints:

- one assignment per class
- strict prerequisite ordering
- no same-period time conflicts
- default max classes per period: `6`
- configurable max classes per period
- optional max weekly hours per period

Fixed-horizon balancing stage:

- keeps the optimal period count found in stage 1
- builds front-loaded target loads for the chosen horizon
- prefers earlier curriculum classes in earlier periods when prerequisite bounds allow it
- penalizes lateness more than earliness so classes are not pushed right without a reason
- preserves the best soft-preference penalty value found in the primary solve

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
- if `maxClassesPerPeriod` is omitted or invalid, it defaults to `6`
- after the optimal horizon is found, the solver may apply a balancing pass within that same horizon
- output includes `optionIndex` (original option index) and `filteredOptionIndex`
- output meta includes applied constraints and solver optimality status
- output meta may include `balancedScheduleApplied` and `balanceProfile`

## Why this is better for your priority

- It is exact on period minimization whenever solved within timeout.
- It avoids highly skewed plans where early periods stay sparse and later periods become cluttered.
- On the provided real datasets, it keeps the same optimal period count while producing more curriculum-aligned distributions.

## Current benchmark snapshot (Mar 10, 2026)

Command: `npm run bench:algorithm`

Real dataset `mecatronica-2026C1.json`:

- `greedy`: `11` periods
- `hybrid`: `11` periods
- `mipMinPeriods`: `11` periods
- MIP optimality status: `optimal_proven`
- balancing stage applied on the returned schedule
- example period-load distribution is now more even while preserving the same `11` periods

Small random instances vs oracle:

- MIP exact matches: `20/20`
- MIP gap vs oracle: max `0`

## Test status

Command: `npm run test:algorithm`

- Result: `25/25` tests passing.
- Includes dedicated test proving mecatronica optimum under 5s:
  - `test/algorithm/mipMinPeriods.test.js`
- Includes entrypoint constraint tests:
  - `test/algorithm/entrypoint.test.js`
- Includes balancing and default-cap regression coverage:
  - `test/algorithm/mipMinPeriods.test.js`
  - `test/algorithm/entrypoint.test.js`

## Recommendation

For algorithm-first backend stage, use `solveWithMipMinPeriods` as default scheduler.

- It directly optimizes your highest-priority metric (fewest periods)
- It now produces schedules that are more balanced and closer to curriculum order
- It stays within the `<5s` runtime budget on current real data
