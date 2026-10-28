import { useMemo, useState } from 'react'

import {
  SOURCE_NOTICE,
  SYNTHETIC_DATA_NOTICE,
  components,
  deployments,
} from './data'
import {
  aggregateAssemblies,
  filterActive,
  findDeployment,
  formatLengthM,
  formatWeightKg,
  joinDeployments,
  normaliseUnits,
} from './domain'

type StepId =
  | 'source'
  | 'filter-active'
  | 'normalise-units'
  | 'join-deployments'
  | 'aggregate-assemblies'

interface StepDefinition {
  id: StepId
  label: string
  hint: string
}

const STEPS: readonly StepDefinition[] = [
  {
    id: 'source',
    label: 'Source tables',
    hint: 'The two raw input tables. They are fixed and are never rewritten by the pipeline.',
  },
  {
    id: 'filter-active',
    label: 'Filter active',
    hint: 'Keeps the components whose active flag is true. Inactive components are dropped here.',
  },
  {
    id: 'normalise-units',
    label: 'Normalise units',
    hint: 'Adds a lengthM column derived from lengthCm. The original lengthCm value is kept.',
  },
  {
    id: 'join-deployments',
    label: 'Join deployments',
    hint: 'Matches every deployment to the components of the assembly it references.',
  },
  {
    id: 'aggregate-assemblies',
    label: 'Aggregate assemblies',
    hint: 'Totals the components per assembly. This is the final view of the pipeline.',
  },
]

export default function App() {
  const [step, setStep] = useState<StepId>('source')
  const [includeUnmatched, setIncludeUnmatched] = useState(true)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null)
  const [runCount, setRunCount] = useState(0)

  const pipeline = useMemo(() => {
    const active = filterActive(components)
    const normalised = normaliseUnits(active)
    const joined = joinDeployments(normalised, deployments)
    const assemblies = aggregateAssemblies(joined, includeUnmatched)
    return { active, normalised, joined, assemblies }
  }, [includeUnmatched])

  const selectedDeployment = useMemo(
    () => (selectedDeploymentId ? findDeployment(pipeline.joined, selectedDeploymentId) : null),
    [pipeline.joined, selectedDeploymentId],
  )

  const matchedCount = pipeline.joined.filter((row) => row.matched).length
  const unmatchedCount = pipeline.joined.length - matchedCount

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">Dual Orbit · Data engineering demo</p>
        <h1>Assembly Transform Lab</h1>
        <p className="lede">
          A stepwise transformation pipeline: filter the components, normalise their units, join them to
          the deployment runs and aggregate the result per assembly. Every step below shows the real rows
          it produces.
        </p>
        <p className="notice" data-testid="synthetic-notice">
          {SYNTHETIC_DATA_NOTICE}
        </p>
      </header>

      <main>
        <section className="panel" aria-labelledby="controls-heading">
          <h2 id="controls-heading">Run control</h2>
          <div className="controls">
            <button
              type="button"
              className="button primary"
              data-testid="run-pipeline"
              onClick={() => setRunCount((count) => count + 1)}
            >
              {runCount === 0 ? 'Run pipeline' : 'Rerun pipeline'}
            </button>
            <button
              type="button"
              className="button"
              data-testid="reset-lab"
              onClick={() => {
                setStep('source')
                setIncludeUnmatched(true)
                setSelectedDeploymentId(null)
                setRunCount(0)
              }}
            >
              Reset
            </button>
            <label className="toggle" htmlFor="include-unmatched">
              <input
                id="include-unmatched"
                type="checkbox"
                data-testid="include-unmatched"
                checked={includeUnmatched}
                onChange={(event) => setIncludeUnmatched(event.target.checked)}
              />
              <span>Include unmatched</span>
            </label>
            <p className="hint">
              Include unmatched controls the final aggregated view. The join inspector always lists every
              deployment so that a mismatch can be investigated.
            </p>
          </div>

          <dl className="stats">
            <div className="stat">
              <dt>Source components</dt>
              <dd data-testid="stat-components">{components.length}</dd>
            </div>
            <div className="stat">
              <dt>Active components</dt>
              <dd data-testid="stat-active">{pipeline.active.length}</dd>
            </div>
            <div className="stat">
              <dt>Deployments</dt>
              <dd data-testid="stat-deployments">{deployments.length}</dd>
            </div>
            <div className="stat">
              <dt>Matched</dt>
              <dd data-testid="stat-matched">{matchedCount}</dd>
            </div>
            <div className="stat">
              <dt>Unmatched</dt>
              <dd data-testid="stat-unmatched">{unmatchedCount}</dd>
            </div>
            <div className="stat">
              <dt>Assemblies</dt>
              <dd data-testid="stat-assemblies">{pipeline.assemblies.length}</dd>
            </div>
            <div className="stat">
              <dt>Pipeline runs</dt>
              <dd data-testid="stat-runs">{runCount}</dd>
            </div>
          </dl>
        </section>

        <section className="panel" aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading">Pipeline steps</h2>
          <nav className="steps" aria-label="Pipeline steps">
            {STEPS.map((definition, index) => (
              <button
                key={definition.id}
                type="button"
                className="step-button"
                data-testid={`step-${definition.id}`}
                aria-pressed={step === definition.id}
                onClick={() => setStep(definition.id)}
              >
                <span className="step-index">{index + 1}</span>
                <span className="step-label">{definition.label}</span>
              </button>
            ))}
          </nav>
          <p className="hint" data-testid="step-hint">
            {STEPS.find((definition) => definition.id === step)?.hint}
          </p>

          <div className="step-panel" data-testid="step-panel">
            {step === 'source' && (
              <>
                <p className="hint">{SOURCE_NOTICE}</p>
                <div className="table-scroll">
                  <table data-testid="raw-components-table">
                    <caption>Raw components ({components.length} rows)</caption>
                    <thead>
                      <tr>
                        <th scope="col">componentId</th>
                        <th scope="col">assemblyCode</th>
                        <th scope="col">lengthCm</th>
                        <th scope="col">weightKg</th>
                        <th scope="col">active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((row) => (
                        <tr key={row.componentId} data-testid="raw-component-row">
                          <td>{row.componentId}</td>
                          <td>{row.assemblyCode}</td>
                          <td>{row.lengthCm}</td>
                          <td>{row.weightKg}</td>
                          <td>{row.active ? 'true' : 'false'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-scroll">
                  <table data-testid="raw-deployments-table">
                    <caption>Raw deployments ({deployments.length} rows)</caption>
                    <thead>
                      <tr>
                        <th scope="col">deploymentId</th>
                        <th scope="col">assemblyRef</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deployments.map((row) => (
                        <tr key={row.deploymentId} data-testid="raw-deployment-row">
                          <td>{row.deploymentId}</td>
                          <td>{row.assemblyRef}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {step === 'filter-active' && (
              <div className="table-scroll">
                <table data-testid="filter-table">
                  <caption>Active components after the filter step ({pipeline.active.length} rows)</caption>
                  <thead>
                    <tr>
                      <th scope="col">componentId</th>
                      <th scope="col">assemblyCode</th>
                      <th scope="col">lengthCm</th>
                      <th scope="col">weightKg</th>
                      <th scope="col">active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.active.map((row) => (
                      <tr key={row.componentId} data-testid="filter-row">
                        <td>{row.componentId}</td>
                        <td>{row.assemblyCode}</td>
                        <td>{row.lengthCm}</td>
                        <td>{row.weightKg}</td>
                        <td>{row.active ? 'true' : 'false'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step === 'normalise-units' && (
              <div className="table-scroll">
                <table data-testid="normalise-table">
                  <caption>
                    Normalised components ({pipeline.normalised.length} rows, lengthM added)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">componentId</th>
                      <th scope="col">assemblyCode</th>
                      <th scope="col">lengthCm</th>
                      <th scope="col">lengthM</th>
                      <th scope="col">weightKg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.normalised.map((row) => (
                      <tr key={row.componentId} data-testid="normalise-row">
                        <td>{row.componentId}</td>
                        <td>{row.assemblyCode}</td>
                        <td>{row.lengthCm}</td>
                        <td data-field="lengthM">{row.lengthM.toFixed(1)}</td>
                        <td>{row.weightKg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step === 'join-deployments' && (
              <div className="table-scroll">
                <table data-testid="join-table">
                  <caption>Deployments after the join step ({pipeline.joined.length} rows)</caption>
                  <thead>
                    <tr>
                      <th scope="col">deploymentId</th>
                      <th scope="col">assemblyRef</th>
                      <th scope="col">match</th>
                      <th scope="col">components</th>
                      <th scope="col">total length</th>
                      <th scope="col">total weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.joined.map((row) => (
                      <tr
                        key={row.deploymentId}
                        data-testid="join-row"
                        data-deployment={row.deploymentId}
                      >
                        <td>{row.deploymentId}</td>
                        <td>{row.assemblyRef}</td>
                        <td data-field="match">{row.matched ? 'matched' : 'unmatched'}</td>
                        <td data-field="componentCount">{row.componentCount}</td>
                        <td data-field="totalLength">{formatLengthM(row.totalLengthM)}</td>
                        <td data-field="totalWeight">{formatWeightKg(row.totalWeightKg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step === 'aggregate-assemblies' && (
              <div className="table-scroll">
                <table data-testid="aggregate-table">
                  <caption>
                    Final aggregated view ({pipeline.assemblies.length} rows, include unmatched is{' '}
                    {includeUnmatched ? 'on' : 'off'})
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">assemblyCode</th>
                      <th scope="col">deployments</th>
                      <th scope="col">components</th>
                      <th scope="col">total length</th>
                      <th scope="col">total weight</th>
                      <th scope="col">match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.assemblies.map((row) => (
                      <tr
                        key={row.assemblyCode}
                        data-testid="aggregate-row"
                        data-assembly={row.assemblyCode}
                      >
                        <td data-field="assemblyCode">{row.assemblyCode}</td>
                        <td data-field="deploymentIds">{row.deploymentIds.join(', ')}</td>
                        <td data-field="componentCount">{row.componentCount}</td>
                        <td data-field="totalLength">{formatLengthM(row.totalLengthM)}</td>
                        <td data-field="totalWeight">{formatWeightKg(row.totalWeightKg)}</td>
                        <td data-field="match">{row.matched ? 'matched' : 'unmatched'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="inspector-heading">
          <h2 id="inspector-heading">Deployment inspector</h2>
          <p className="hint">
            Pick a deployment to see the components it matched, the total length and the total weight.
          </p>
          <div className="deployment-list" role="group" aria-label="Deployments">
            {pipeline.joined.map((row) => (
              <button
                key={row.deploymentId}
                type="button"
                className="deployment-button"
                data-testid={`deployment-${row.deploymentId}`}
                aria-pressed={selectedDeploymentId === row.deploymentId}
                onClick={() => setSelectedDeploymentId(row.deploymentId)}
              >
                <span className="deployment-id">{row.deploymentId}</span>
                <span className="deployment-ref">{row.assemblyRef}</span>
                <span className={row.matched ? 'badge matched' : 'badge unmatched'}>
                  {row.matched ? 'matched' : 'unmatched'}
                </span>
              </button>
            ))}
          </div>

          <div className="step-panel" data-testid="deployment-detail">
            {!selectedDeployment && (
              <p className="hint" data-testid="deployment-empty">
                No deployment selected yet.
              </p>
            )}

            {selectedDeployment && !selectedDeployment.matched && (
              <div className="warning" data-testid="unmatched-warning">
                <strong>Unmatched deployment.</strong> {selectedDeployment.deploymentId} references assembly{' '}
                {selectedDeployment.assemblyRef}, and no active component belongs to that assembly. Nothing
                was joined for this deployment, so it contributes no length and no weight.
              </div>
            )}

            {selectedDeployment && (
              <>
                <p className="hint">
                  {selectedDeployment.deploymentId} → {selectedDeployment.assemblyRef}
                </p>
                <dl className="stats">
                  <div className="stat">
                    <dt>Components</dt>
                    <dd data-testid="detail-component-count">{selectedDeployment.componentCount}</dd>
                  </div>
                  <div className="stat">
                    <dt>Total length</dt>
                    <dd data-testid="detail-total-length">
                      {formatLengthM(selectedDeployment.totalLengthM)}
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>Total weight</dt>
                    <dd data-testid="detail-total-weight">
                      {formatWeightKg(selectedDeployment.totalWeightKg)}
                    </dd>
                  </div>
                </dl>
                {selectedDeployment.matched && (
                  <div className="table-scroll">
                    <table data-testid="matched-components-table">
                      <caption>
                        Components matched by {selectedDeployment.deploymentId} (
                        {selectedDeployment.componentCount})
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">componentId</th>
                          <th scope="col">assemblyCode</th>
                          <th scope="col">lengthCm</th>
                          <th scope="col">lengthM</th>
                          <th scope="col">weightKg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDeployment.components.map((component) => (
                          <tr key={component.componentId} data-testid="matched-component-row">
                            <td>{component.componentId}</td>
                            <td>{component.assemblyCode}</td>
                            <td>{component.lengthCm}</td>
                            <td>{component.lengthM.toFixed(1)}</td>
                            <td>{component.weightKg}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p className="notice" data-testid="footer-notice">
          {SYNTHETIC_DATA_NOTICE}
        </p>
        <p className="hint">
          Assembly Transform Lab — a clean-room demonstration of stepwise filtering, normalisation, joining
          and aggregation.
        </p>
      </footer>
    </div>
  )
}
