/**
 * Synthetic fixtures for the Assembly Transform Lab.
 *
 * Every value in this file was invented for this demo. Nothing here is derived
 * from a real client project, a real asset register, a real deployment log or
 * any well, field or subsurface dataset. The identifiers are deliberately
 * neutral (C-01, AX-1, D-100) so that the demo teaches the transformation
 * mechanics without carrying any recognisable project vocabulary.
 */

/** One component that belongs to an assembly. */
export interface ComponentRow {
  componentId: string
  assemblyCode: string
  lengthCm: number
  weightKg: number
  active: boolean
}

/** One deployment run that points at an assembly. */
export interface DeploymentRow {
  deploymentId: string
  assemblyRef: string
}

export const SYNTHETIC_DATA_NOTICE =
  'Synthetic data only. Every component, deployment and measurement in this lab was invented for the demo.'

export const SOURCE_NOTICE =
  'The two source tables below are the only inputs of this pipeline. They never change, no matter how many times you run or reset the lab.'

function freezeComponent(row: ComponentRow): ComponentRow {
  return Object.freeze({ ...row })
}

function freezeDeployment(row: DeploymentRow): DeploymentRow {
  return Object.freeze({ ...row })
}

/** Six components, one of which (C-03) is inactive. */
export const components: readonly ComponentRow[] = Object.freeze([
  freezeComponent({ componentId: 'C-01', assemblyCode: 'AX-1', lengthCm: 120, weightKg: 20, active: true }),
  freezeComponent({ componentId: 'C-02', assemblyCode: 'AX-1', lengthCm: 80, weightKg: 10, active: true }),
  freezeComponent({ componentId: 'C-03', assemblyCode: 'AX-1', lengthCm: 50, weightKg: 5, active: false }),
  freezeComponent({ componentId: 'C-04', assemblyCode: 'BX-2', lengthCm: 200, weightKg: 30, active: true }),
  freezeComponent({ componentId: 'C-05', assemblyCode: 'BX-2', lengthCm: 100, weightKg: 15, active: true }),
  freezeComponent({ componentId: 'C-06', assemblyCode: 'CX-3', lengthCm: 150, weightKg: 12, active: true }),
])

/** Five deployments; D-104 points at an assembly that has no components at all. */
export const deployments: readonly DeploymentRow[] = Object.freeze([
  freezeDeployment({ deploymentId: 'D-100', assemblyRef: 'AX-1' }),
  freezeDeployment({ deploymentId: 'D-101', assemblyRef: 'AX-1' }),
  freezeDeployment({ deploymentId: 'D-102', assemblyRef: 'BX-2' }),
  freezeDeployment({ deploymentId: 'D-103', assemblyRef: 'CX-3' }),
  freezeDeployment({ deploymentId: 'D-104', assemblyRef: 'ZZ-9' }),
])

/** Human readable description of the two raw tables, used by the UI and README. */
export const SOURCE_TABLES = Object.freeze([
  Object.freeze({ key: 'components', label: 'Components', rows: components.length, fields: 'componentId, assemblyCode, lengthCm, weightKg, active' }),
  Object.freeze({ key: 'deployments', label: 'Deployments', rows: deployments.length, fields: 'deploymentId, assemblyRef' }),
])
