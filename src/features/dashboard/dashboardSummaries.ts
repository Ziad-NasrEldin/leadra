import { compareText, type LocaleCode } from '../../lib/i18n'
import { isSoldStatus, summarizeDestinations, summarizeProjects } from '../../lib/domain'
import type { AppDataState, DestinationSummary, LeadraUnit, LookupValue, ProjectSummary } from '../../lib/types'

export type DashboardRollup = {
  id: string
  label: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
  meta?: string
}

export function buildTeamDashboardRollups(units: LeadraUnit[], appState: AppDataState, locale: LocaleCode): DashboardRollup[] {
  return appState.teams
    .map((team) => {
      const teamUnits = units.filter((unit) => unit.teamId === team.id)
      const activeMembers = appState.users.filter((member) => member.teamId === team.id && member.status === 'active').length
      return summarizeDashboardRollup(team.id, team.name, teamUnits, locale === 'ar' ? `${activeMembers} أعضاء نشطون` : `${activeMembers} active members`)
    })
    .filter((item) => item.totalUnits > 0 || item.meta)
    .sort((a, b) => sortDashboardRollups(a, b, locale))
}

export function buildUnitDashboardRollups(
  units: LeadraUnit[],
  idKey: 'developerId' | 'destinationId' | 'projectId',
  labelKey: 'developerName' | 'destinationName' | 'projectName',
  locale: LocaleCode,
): DashboardRollup[] {
  const grouped = new Map<string, LeadraUnit[]>()
  for (const unit of units) {
    const current = grouped.get(unit[idKey])
    if (current) current.push(unit)
    else grouped.set(unit[idKey], [unit])
  }

  return Array.from(grouped.entries())
    .map(([id, groupedUnits]) => summarizeDashboardRollup(id, groupedUnits[0][labelKey], groupedUnits))
    .sort((a, b) => sortDashboardRollups(a, b, locale))
}

export function summarizeDestinationsWithLookups(units: LeadraUnit[], lookups: LookupValue[], locale: LocaleCode): DestinationSummary[] {
  const summaries = new Map(summarizeDestinations(units, locale).map((summary) => [summary.destinationId, summary]))

  for (const lookup of lookups) {
    if (lookup.kind !== 'destination' || summaries.has(lookup.id)) continue
    summaries.set(lookup.id, {
      destinationId: lookup.id,
      destinationName: lookup.label,
      totalUnits: 0,
      availableUnits: 0,
      holdUnits: 0,
      soldUnits: 0,
    })
  }

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.destinationName, b.destinationName))
}

export function summarizeProjectsWithLookups(units: LeadraUnit[], lookups: LookupValue[], locale: LocaleCode, destinationId?: string | null): ProjectSummary[] {
  const summaries = new Map(summarizeProjects(units, locale, destinationId).map((summary) => [summary.projectId, summary]))

  for (const lookup of lookups) {
    if (lookup.kind !== 'project' || summaries.has(lookup.id)) continue
    summaries.set(lookup.id, {
      projectId: lookup.id,
      projectName: lookup.label,
      destinationId: destinationId ?? undefined,
      totalUnits: 0,
      availableUnits: 0,
      holdUnits: 0,
      soldUnits: 0,
    })
  }

  return Array.from(summaries.values()).sort((a, b) => compareText(locale, a.projectName, b.projectName))
}

function summarizeDashboardRollup(id: string, label: string, units: LeadraUnit[], meta?: string): DashboardRollup {
  return {
    id,
    label,
    totalUnits: units.length,
    availableUnits: units.filter((unit) => unit.status === 'available').length,
    holdUnits: units.filter((unit) => unit.status === 'hold').length,
    soldUnits: units.filter((unit) => isSoldStatus(unit.status)).length,
    meta,
  }
}

function sortDashboardRollups(a: DashboardRollup, b: DashboardRollup, locale: LocaleCode) {
  return b.totalUnits - a.totalUnits || compareText(locale, a.label, b.label)
}
