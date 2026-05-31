import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { demoUsers, initialAppState, lookupValues } from '../../data/seed'
import { summarizeDestinations, summarizeProjects } from '../../lib/domain'
import { LocaleProvider } from '../../lib/i18n'
import type { LeadraUnit, UnitFilters } from '../../lib/types'
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

describe('UnitsPage loading state', () => {
  it('does not show the no-matches empty state while an empty unit list is still loading', () => {
    renderUnitsPage(true, [])

    expect(screen.getByTestId('unit-list-loading-state')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/loading units/i)
    expect(screen.queryByText(/no units match these filters/i)).not.toBeInTheDocument()
  })

  it('keeps rendered unit rows visible during quick refreshes', () => {
    renderUnitsPage(true)

    expect(screen.queryByTestId('unit-list-loading-state')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^open /i }).length).toBeGreaterThan(0)
  })
})
