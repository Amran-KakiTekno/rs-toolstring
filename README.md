# Assembly Transform Lab (`rs-toolstring`)

A standalone, English-only, fully client-side single-page demo for
`https://rs-toolstring.pages.dev`. It shows a stepwise transformation pipeline over two small
**synthetic** tables: filter, normalise, join, aggregate — and lets you inspect the real rows that
each step produces.

There is no backend, no transformation runtime, no file import, no external fetch, no routing and no
persistence. Everything happens in the browser.

## Synthetic data provenance

Every value in `src/data.ts` was invented for this demo.

* The six components (`C-01` … `C-06`), the three assembly codes (`AX-1`, `BX-2`, `CX-3`) and the
  five deployments (`D-100` … `D-104`) are fictional placeholders.
* All lengths, weights and flags are arbitrary round numbers chosen to make the arithmetic legible.
* The field names (`componentId`, `assemblyCode`, `lengthCm`, `weightKg`, `active`, `deploymentId`,
  `assemblyRef`) and the pipeline step names are generic data-engineering vocabulary. They carry no
  data, schema, code or vocabulary from any client project, and the demo contains **no real well,
  field, asset or production data** of any kind.
* The two source tables are frozen in the module and are never rewritten by the pipeline, so a rerun
  or a reset cannot change the fixtures.

The page shows a visible **Synthetic data only** notice in the header and in the footer.

## The pipeline

| Step | What it does | Rows out |
| --- | --- | ---: |
| `Filter active` | keeps components whose `active` flag is true | 5 of 6 |
| `Normalise units` | adds `lengthM = lengthCm / 100`; `lengthCm` is preserved untouched | 5 |
| `Join deployments` | matches each deployment to the components of the assembly it references | 5 (4 matched, 1 unmatched) |
| `Aggregate assemblies` | totals the distinct components per assembly | 3, or 4 with unmatched included |

### Pinned results

* Active components: **5** (the inactive `C-03` never contributes to any total).
* Joined deployments: **5** — matched **4**, unmatched **1** (`D-104` → `ZZ-9`, which has no
  components at all).
* `AX-1`: **2 components, 2.0 m, 30 kg**. `D-100` and `D-101` both point at `AX-1`, so the aggregate
  counts the two components once, not twice.
* `BX-2`: 2 components, 3.0 m, 45 kg. `CX-3`: 1 component, 1.5 m, 12 kg.
* An unmatched deployment is never silently dropped: it is carried through the join with
  `matched: false` and an empty component list, and it is reported with a clear warning.

## Using the demo

1. Read the two raw tables on the **Source tables** step.
2. Move through **Filter active**, **Normalise units**, **Join deployments** and
   **Aggregate assemblies**. Each step shows the rows it actually produces.
3. Pick a deployment in the **Deployment inspector** to see the components it matched, the total
   length and the total weight — or a clear unmatched warning for `D-104`.
4. Use the **Include unmatched** toggle to show or hide the unmatched deployment in the final
   aggregated view.
5. **Run pipeline** / **Rerun pipeline** and **Reset** re-execute the pipeline. The source fixtures
   never change and rows are never duplicated.

## Local commands

```bash
npm ci                 # clean install from the lockfile
npm run dev            # dev server on http://127.0.0.1:4103
npm run typecheck      # tsc --noEmit
npm run test           # Vitest unit tests (src/domain.test.ts)
npm run build          # typecheck + production build into dist/
npm run test:e2e       # Playwright against the built app (system Chrome)
npm run verify:build   # dist/ artifact check, prints VERIFY_OK rs-toolstring
npm run verify         # typecheck -> unit -> build -> Playwright -> verify-build
```

The Playwright suite uses the headless system Chrome (`channel: "chrome"`) through the `chrome`
channel, serves the built `dist/` with `vite preview` on port **4103**, and never reuses an already
running server (`reuseExistingServer: false`).

## Project layout

| Path | Purpose |
| --- | --- |
| `src/data.ts` | The frozen synthetic fixtures and the synthetic-data notice. |
| `src/domain.ts` | The pure steps: `filterActive`, `normaliseUnits`, `joinDeployments`, `aggregateAssemblies`, plus `runPipeline` and small selectors/formatters. |
| `src/domain.test.ts` | Vitest suite pinning every count, value, unmatched behaviour and input immutability. |
| `src/App.tsx` | The lab UI: step navigation, the transformed-row tables, the deployment inspector and the unmatched toggle. |
| `src/styles.css` | Dark lab styling, responsive down to 390 px. |
| `tests/demo.spec.ts` | Playwright suite: steps, deployment inspection, unmatched warning, toggle, rerun/reset, accessibility, mobile overflow, offline runtime. |
| `scripts/verify-build.mjs` | Requires exactly one HTML file plus non-empty JS/CSS in `dist/` and prints `VERIFY_OK rs-toolstring`. |

## Boundaries

* Client-side only. No API, no server, no persistence, no analytics.
* No external request at runtime: the page loads only its own bundle and stylesheet.
* No credentials of any kind are used, stored or requested.
* The pipeline step names describe a general idea of stepwise transformation. This demo is not
  affiliated with, and does not reproduce, any specific transformation product.
