# Complex Model Benchmark (Web Interaction)

## Files

- `complex-task-benchmark.html` — benchmark app entry page
- `complex-task-benchmark.css` — styles
- `complex-task-benchmark.js` — deterministic task logic + export
- `frame-challenge.html` — iframe sub-challenge
- `task-manifest.json` — canonical task + scoring definition

## Run locally

1. Open `tests/benchmarks/complex-task-benchmark.html` in browser.
2. Set:
   - Run label (e.g., `claude-chrome-r1`)
   - Model name
3. Execute all 10 tasks.
4. Click **Export Benchmark JSON**.
5. Save JSON as artifact for that model run.

## Comparison protocol

- Use identical machine/network conditions.
- Use at least 3 runs per model.
- Compare:
  - `% tasks complete`
  - `time to full completion`
  - `eventCount` (proxy for action efficiency)
  - success of hardest tasks (`t6`, `t7`, `t8`, `t9`, `t10`)

## Determinism notes

- OTP is generated at request-time and shown in-page.
- Table task, iframe challenge, and infinite scroll target are fixed.
- Final proof code is deterministic for run metadata + solved outputs.

