/**
 * Pure transformation steps for the Assembly Transform Lab.
 *
 * The four steps mirror the idea of a stepwise transformation engine: each step
 * takes the rows produced by the previous step, returns brand new rows, and
 * never mutates its inputs. Unmatched values are never dropped silently — they
 * are carried forward with an explicit `matched: false` flag so the UI can
 * explain what happened.
 *
 * The step names are generic pipeline vocabulary (filter, normalise, join,
 * aggregate). They are not modelled on, and carry no code or vocabulary from,
 * any specific transformation product.
 */

import type { ComponentRow, DeploymentRow } from './data'

/** A component row after unit normalisation: centimetres are kept, metres are added. */
export interface NormalisedComponentRow extends ComponentRow {
  lengthM: number
}

/** A deployment after the join step, with the components it matched. */
export interface JoinedDeployment {
  deploymentId: string
  assemblyRef: string
  matched: boolean
  components: NormalisedComponentRow[]
  componentCount: number
  totalLengthM: number
  totalWeightKg: number
}

/** One aggregated assembly in the final view. */
export interface AssemblySummary {
  assemblyCode: string
  deploymentIds: string[]
  componentCount: number
  totalLengthM: number
  totalWeightKg: number
  matched: boolean
}

/** The result of running the whole pipeline once. */
export interface PipelineSnapshot {
  activeComponents: NormalisedComponentRow[]
  joinedDeployments: JoinedDeployment[]
  assemblies: AssemblySummary[]
  matchedCount: number
  unmatchedCount: number
}

/** Round away binary floating point dust so 1.2 + 0.8 is exactly 2. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/**
 * Step 1 — `filterActive`.
 * Keeps the rows whose `active` flag is true and returns new row objects.
 */
export function filterActive(rows: readonly ComponentRow[]): ComponentRow[] {
  return rows.filter((row) => row.active === true).map((row) => ({ ...row }))
}

/**
 * Step 2 — `normaliseUnits`.
 * Adds a `lengthM` column derived from `lengthCm`. The original `lengthCm`
 * value is preserved unchanged, and the input rows are never mutated.
 */
export function normaliseUnits(rows: readonly ComponentRow[]): NormalisedComponentRow[] {
  return rows.map((row) => ({ ...row, lengthM: round6(row.lengthCm / 100) }))
}

/**
 * Step 3 — `joinDeployments`.
 * Joins every deployment against the normalised components on
 * `deployment.assemblyRef === component.assemblyCode`.
 *
 * A deployment that finds no component is kept and flagged `matched: false`
 * with an empty component list, so an unmatched deployment is never lost.
 */
export function joinDeployments(
  components: readonly NormalisedComponentRow[],
  deployments: readonly DeploymentRow[],
): JoinedDeployment[] {
  return deployments.map((deployment) => {
    const matchedComponents = components
      .filter((component) => component.assemblyCode === deployment.assemblyRef)
      .map((component) => ({ ...component }))

    return {
      deploymentId: deployment.deploymentId,
      assemblyRef: deployment.assemblyRef,
      matched: matchedComponents.length > 0,
      components: matchedComponents,
      componentCount: matchedComponents.length,
      totalLengthM: round6(
        matchedComponents.reduce((sum, component) => sum + component.lengthM, 0),
      ),
      totalWeightKg: round6(
        matchedComponents.reduce((sum, component) => sum + component.weightKg, 0),
      ),
    }
  })
}

/**
 * Step 4 — `aggregateAssemblies`.
 * Groups the joined deployments by assembly reference and totals the distinct
 * components of each assembly, so two deployments that point at the same
 * assembly (D-100 and D-101 both point at AX-1) do not double count.
 *
 * When `includeUnmatched` is false the unmatched assembly is left out of the
 * final view; when it is true the unmatched assembly is kept and flagged.
 */
export function aggregateAssemblies(
  joined: readonly JoinedDeployment[],
  includeUnmatched: boolean,
): AssemblySummary[] {
  const groups = new Map<string, { deploymentIds: string[]; components: Map<string, NormalisedComponentRow> }>()

  for (const deployment of joined) {
    const key = deployment.assemblyRef
    let group = groups.get(key)
    if (!group) {
      group = { deploymentIds: [], components: new Map<string, NormalisedComponentRow>() }
      groups.set(key, group)
    }
    group.deploymentIds.push(deployment.deploymentId)
    for (const component of deployment.components) {
      if (!group.components.has(component.componentId)) {
        group.components.set(component.componentId, component)
      }
    }
  }

  const summaries: AssemblySummary[] = []
  for (const [assemblyCode, group] of groups) {
    const components = [...group.components.values()]
    const matched = components.length > 0
    if (!matched && !includeUnmatched) continue

    summaries.push({
      assemblyCode,
      deploymentIds: [...group.deploymentIds],
      componentCount: components.length,
      totalLengthM: round6(components.reduce((sum, component) => sum + component.lengthM, 0)),
      totalWeightKg: round6(components.reduce((sum, component) => sum + component.weightKg, 0)),
      matched,
    })
  }

  return summaries
}

/** Runs all four steps in order and returns one immutable snapshot of the result. */
export function runPipeline(
  sourceComponents: readonly ComponentRow[],
  sourceDeployments: readonly DeploymentRow[],
  includeUnmatched: boolean,
): PipelineSnapshot {
  const activeComponents = normaliseUnits(filterActive(sourceComponents))
  const joinedDeployments = joinDeployments(activeComponents, sourceDeployments)
  const assemblies = aggregateAssemblies(joinedDeployments, includeUnmatched)

  return {
    activeComponents,
    joinedDeployments,
    assemblies,
    matchedCount: joinedDeployments.filter((deployment) => deployment.matched).length,
    unmatchedCount: joinedDeployments.filter((deployment) => !deployment.matched).length,
  }
}

/** Looks up one joined deployment by id. */
export function findDeployment(
  joined: readonly JoinedDeployment[],
  deploymentId: string,
): JoinedDeployment | null {
  return joined.find((deployment) => deployment.deploymentId === deploymentId) ?? null
}

/** Formats a metre value with one decimal, e.g. `2.0 m`. */
export function formatLengthM(value: number): string {
  return `${value.toFixed(1)} m`
}

/** Formats a kilogram value without a decimal, e.g. `30 kg`. */
export function formatWeightKg(value: number): string {
  return `${Number(value.toFixed(1))} kg`
}
