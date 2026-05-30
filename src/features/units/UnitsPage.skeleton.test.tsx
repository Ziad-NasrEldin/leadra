import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { demoUsers, initialAppState, lookupValues } from '../../data/seed'
import { summarizeDestinations, summarizeProjects } from '../../lib/domain'
import type { LeadraUnit, UnitFilters } from '../../lib/types'
import { LocaleProvider } from '../../lib/i18n'
import { UnitsPage } from './UnitsPage'

const admin = demoUsers.find((user) => user.role === 'admin') ?? demoUsers[0]
const filters: UnitFilters = { status: 'all' }
const noop = vi.fn()

function renderUnitsPage(loading: boolean, units: LeadraUnit[] = initialAppState.units.slice(0, 2)) {
  const destinations = summarizeDestinations(initialAppState.units)
  const projects = summarizeProjects(initialAppState.units, 'en', destinations[0]?.destinationId ?? null)

  return render(
    <LocaleProvider>
      <UnitsPage
      user={admin}
      lookupValues={lookupValues}
      destinations={destinations}
      projects={projects}
      selectedDestinationId={destinations[0]?.destinationId ?? null}
      selectedProjectId={projects[0]?.projectId ?? null}
      stage="units"
      currentDestination={destinations[0] ?? null}
      currentProject={projects[0] ?? null}
      units={units}
      filters={filters}
      selectedUnitIds={[]}
      batchAction={null}
      loading={loading}
      onDestinationSelect={noop}
      onProjectSelect={noop}
      onBackToDestinations={noop}
      onBackToProjects={noop}
      onFilterChange={noop}
      onResetFilters={noop}
      onToggleUnitSelection={noop}
      onSelectVisibleUnits={noop}
      onClearSelection={noop}
      onGenerateSelectedPdfs={noop}
      onDownloadSelectedPdfs={noop}
      onShareSelectedPdfs={noop}
      onOpenUnit={noop}
      />
    </LocaleProvider>,
  )
}

describe('UnitsPage loading skeletons', () => {
  it('shows layout-matched unit skeletons during a controlled loading wait and removes them after data resolves', () => {
    const { rerender } = renderUnitsPage(true, [])

    expect(screen.getByTestId('unit-list-skeleton')).toBeInTheDocument()
    expect(screen.getAllByTestId('unit-row-skeleton').length).toBeGreaterThan(0)

    const destinations = summarizeDestinations(initialAppState.units)
    const projects = summarizeProjects(initialAppState.units, 'en', destinations[0]?.destinationId ?? null)
    rerender(
      <LocaleProvider>
        <UnitsPage
        user={admin}
        lookupValues={lookupValues}
        destinations={destinations}
        projects={projects}
        selectedDestinationId={destinations[0]?.destinationId ?? null}
        selectedProjectId={projects[0]?.projectId ?? null}
        stage="units"
        currentDestination={destinations[0] ?? null}
        currentProject={projects[0] ?? null}
        units={initialAppState.units.slice(0, 2)}
        filters={filters}
        selectedUnitIds={[]}
        batchAction={null}
        loading={false}
        onDestinationSelect={noop}
        onProjectSelect={noop}
        onBackToDestinations={noop}
        onBackToProjects={noop}
        onFilterChange={noop}
        onResetFilters={noop}
        onToggleUnitSelection={noop}
        onSelectVisibleUnits={noop}
        onClearSelection={noop}
        onGenerateSelectedPdfs={noop}
        onDownloadSelectedPdfs={noop}
        onShareSelectedPdfs={noop}
        onOpenUnit={noop}
        />
      </LocaleProvider>,
    )

    expect(screen.queryByTestId('unit-list-skeleton')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^open /i }).length).toBeGreaterThan(0)
  })

  it('keeps rendered unit rows visible instead of swapping back to skeletons during quick refreshes', () => {
    renderUnitsPage(true)

    expect(screen.queryByTestId('unit-list-skeleton')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^open /i }).length).toBeGreaterThan(0)
  })
})
