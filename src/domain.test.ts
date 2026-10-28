import { describe, expect, it } from 'vitest'

import { components, deployments } from './data'
import {
  aggregateAssemblies,
  filterActive,
  findDeployment,
  formatLengthM,
  formatWeightKg,
  joinDeployments,
  normaliseUnits,
  runPipeline,
} from './domain'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value as Record<string, unknown>)) {
      deepFreeze(inner)
    }
  }
  return value
}

function snapshot(rows: readonly unknown[]): string {
  return JSON.stringify(rows)
}

describe('synthetic fixtures', () => {
  it('holds six components and five deployments', () => {
    expect(components).toHaveLength(6)
    expect(deployments).toHaveLength(5)
  })

  it('uses the neutral field names from the brief', () => {
    expect(Object.keys(components[0]).sort()).toEqual([
      'active',
      'assemblyCode',
      'componentId',
      'lengthCm',
      'weightKg',
    ])
    expect(Object.keys(deployments[0]).sort()).toEqual(['assemblyRef', 'deploymentId'])
  })

  it('marks exactly one component inactive', () => {
    expect(components.filter((row) => !row.active).map((row) => row.componentId)).toEqual(['C-03'])
  })
})

describe('filterActive', () => {
  it('keeps five active components and drops C-03', () => {
    const filtered = filterActive(components)
    expect(filtered).toHaveLength(5)
    expect(filtered.map((row) => row.componentId)).toEqual(['C-01', 'C-02', 'C-04', 'C-05', 'C-06'])
    expect(filtered.some((row) => row.componentId === 'C-03')).toBe(false)
  })

  it('returns new rows and never mutates the source rows', () => {
    const before = snapshot(components)
    const filtered = filterActive(components)
    expect(filtered[0]).not.toBe(components[0])
    expect(snapshot(components)).toBe(before)
  })
})

describe('normaliseUnits', () => {
  it('adds lengthM without changing lengthCm', () => {
    const normalised = normaliseUnits(components)
    const first = normalised.find((row) => row.componentId === 'C-01')
    expect(first?.lengthCm).toBe(120)
    expect(first?.lengthM).toBe(1.2)
    expect(normalised.find((row) => row.componentId === 'C-04')?.lengthM).toBe(2)
    expect(normalised.find((row) => row.componentId === 'C-06')?.lengthM).toBe(1.5)
  })

  it('never mutates its input', () => {
    const before = snapshot(components)
    normaliseUnits(components)
    expect(snapshot(components)).toBe(before)
    expect(components.every((row) => !('lengthM' in row))).toBe(true)
  })

  it('returns new row objects', () => {
    const normalised = normaliseUnits(components)
    expect(normalised[0]).not.toBe(components[0])
  })
})

describe('joinDeployments', () => {
  const active = normaliseUnits(filterActive(components))
  const joined = joinDeployments(active, deployments)

  it('produces one row per deployment', () => {
    expect(joined).toHaveLength(5)
    expect(joined.map((row) => row.deploymentId)).toEqual(['D-100', 'D-101', 'D-102', 'D-103', 'D-104'])
  })

  it('matches four deployments and flags exactly one unmatched deployment', () => {
    expect(joined.filter((row) => row.matched)).toHaveLength(4)
    const unmatched = joined.filter((row) => !row.matched)
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0].deploymentId).toBe('D-104')
    expect(unmatched[0].assemblyRef).toBe('ZZ-9')
    expect(unmatched[0].components).toEqual([])
    expect(unmatched[0].componentCount).toBe(0)
  })

  it('matches the components of D-100 with the right totals', () => {
    const d100 = joined.find((row) => row.deploymentId === 'D-100')
    expect(d100?.componentCount).toBe(2)
    expect(d100?.components.map((row) => row.componentId)).toEqual(['C-01', 'C-02'])
    expect(d100?.totalLengthM).toBe(2)
    expect(d100?.totalWeightKg).toBe(30)
  })

  it('never lets the inactive component C-03 into a join', () => {
    expect(joined.some((row) => row.components.some((component) => component.componentId === 'C-03'))).toBe(
      false,
    )
  })

  it('does not mutate the components or the deployments it joins', () => {
    const beforeComponents = snapshot(components)
    const beforeDeployments = snapshot(deployments)
    joinDeployments(active, deployments)
    expect(snapshot(components)).toBe(beforeComponents)
    expect(snapshot(deployments)).toBe(beforeDeployments)
  })
})

describe('aggregateAssemblies', () => {
  const active = normaliseUnits(filterActive(components))
  const joined = joinDeployments(active, deployments)

  it('returns three matched assemblies when unmatched rows are excluded', () => {
    const summaries = aggregateAssemblies(joined, false)
    expect(summaries).toHaveLength(3)
    expect(summaries.map((row) => row.assemblyCode)).toEqual(['AX-1', 'BX-2', 'CX-3'])
    expect(summaries.every((row) => row.matched)).toBe(true)
  })

  it('returns four assemblies when the unmatched deployment is included', () => {
    const summaries = aggregateAssemblies(joined, true)
    expect(summaries).toHaveLength(4)
    const unmatched = summaries.find((row) => row.assemblyCode === 'ZZ-9')
    expect(unmatched).toBeDefined()
    expect(unmatched?.matched).toBe(false)
    expect(unmatched?.componentCount).toBe(0)
    expect(unmatched?.totalLengthM).toBe(0)
    expect(unmatched?.totalWeightKg).toBe(0)
    expect(unmatched?.deploymentIds).toEqual(['D-104'])
  })

  it('totals AX-1 as 2.0 m, 30 kg and 2 components', () => {
    const ax1 = aggregateAssemblies(joined, true).find((row) => row.assemblyCode === 'AX-1')
    expect(ax1?.componentCount).toBe(2)
    expect(ax1?.totalLengthM).toBe(2)
    expect(ax1?.totalWeightKg).toBe(30)
    expect(ax1?.deploymentIds).toEqual(['D-100', 'D-101'])
  })

  it('does not double count the two deployments that point at AX-1', () => {
    const ax1 = aggregateAssemblies(joined, true).find((row) => row.assemblyCode === 'AX-1')
    expect(ax1?.componentCount).toBe(2)
    expect(ax1?.totalLengthM).toBe(2)
  })

  it('totals BX-2 and CX-3 from their active components only', () => {
    const summaries = aggregateAssemblies(joined, true)
    const bx2 = summaries.find((row) => row.assemblyCode === 'BX-2')
    const cx3 = summaries.find((row) => row.assemblyCode === 'CX-3')
    expect(bx2?.componentCount).toBe(2)
    expect(bx2?.totalLengthM).toBe(3)
    expect(bx2?.totalWeightKg).toBe(45)
    expect(cx3?.componentCount).toBe(1)
    expect(cx3?.totalLengthM).toBe(1.5)
    expect(cx3?.totalWeightKg).toBe(12)
  })

  it('never lets the inactive component C-03 contribute', () => {
    const ax1 = aggregateAssemblies(joined, true).find((row) => row.assemblyCode === 'AX-1')
    expect(ax1?.componentCount).toBe(2)
    expect(ax1?.totalLengthM).toBe(2)
    expect(ax1?.totalWeightKg).toBe(30)
  })

  it('does not mutate the joined rows it aggregates', () => {
    const before = snapshot(joined)
    aggregateAssemblies(joined, true)
    expect(snapshot(joined)).toBe(before)
  })
})

describe('runPipeline', () => {
  it('reports the pinned counts of the whole pipeline', () => {
    const withUnmatched = runPipeline(components, deployments, true)
    expect(withUnmatched.activeComponents).toHaveLength(5)
    expect(withUnmatched.joinedDeployments).toHaveLength(5)
    expect(withUnmatched.matchedCount).toBe(4)
    expect(withUnmatched.unmatchedCount).toBe(1)
    expect(withUnmatched.assemblies).toHaveLength(4)

    const withoutUnmatched = runPipeline(components, deployments, false)
    expect(withoutUnmatched.assemblies).toHaveLength(3)
  })

  it('produces the same rows when it is run again', () => {
    const first = runPipeline(components, deployments, true)
    const second = runPipeline(components, deployments, true)
    expect(second).toEqual(first)
  })

  it('leaves the source fixtures untouched', () => {
    deepFreeze(components)
    deepFreeze(deployments)
    const before = snapshot(components)
    const beforeDeployments = snapshot(deployments)
    runPipeline(components, deployments, true)
    expect(snapshot(components)).toBe(before)
    expect(snapshot(deployments)).toBe(beforeDeployments)
  })
})

describe('selectors and formatting', () => {
  it('finds a joined deployment by id and returns null for an unknown id', () => {
    const joined = joinDeployments(normaliseUnits(filterActive(components)), deployments)
    expect(findDeployment(joined, 'D-104')?.matched).toBe(false)
    expect(findDeployment(joined, 'D-999')).toBeNull()
  })

  it('formats lengths and weights for display', () => {
    expect(formatLengthM(2)).toBe('2.0 m')
    expect(formatLengthM(1.5)).toBe('1.5 m')
    expect(formatWeightKg(30)).toBe('30 kg')
    expect(formatWeightKg(12.5)).toBe('12.5 kg')
  })
})
