import { Download, FileText, Image as ImageIcon, Share2, SlidersHorizontal, X } from 'lucide-react'
import { memo, useState, type CSSProperties } from 'react'
import { canViewOwnerData, getThumbnailMedia, summarizeDestinations, summarizeProjects } from '../../lib/domain'
import { compareText, formatCount, getStatusLabel, useLocale } from '../../lib/i18n'
import type { InstallmentType, LeadraUnit, LeadraUser, LookupValue, PaymentMethod, UnitFilters, UnitStatus } from '../../lib/types'
import { ControlledSelectField, EmptyState } from '../../components/LeadraUi'
import { unitListPageSize } from '../shared/constants'
import { motionStyle } from '../shared/motion'
import { countActiveUnitFilters, parseOptionalNumber } from '../shared/formUtils'
import { useLookupThumbnailSources } from '../shared/media'

type UnitsBrowserStage = 'destinations' | 'projects' | 'units'

export function UnitsPage({
  user,
  lookupValues,
  destinations,
  projects,
  selectedDestinationId,
  selectedProjectId,
  stage,
  currentDestination,
  currentProject,
  units,
  filters,
  selectedUnitIds,
  batchAction,
  onDestinationSelect,
  onProjectSelect,
  onBackToDestinations,
  onBackToProjects,
  onFilterChange,
  onResetFilters,
  onToggleUnitSelection,
  onSelectVisibleUnits,
  onClearSelection,
  onGenerateSelectedPdfs,
  onDownloadSelectedPdfs,
  onShareSelectedPdfs,
  onOpenUnit,
}: {
  user: LeadraUser
  lookupValues: LookupValue[]
  destinations: ReturnType<typeof summarizeDestinations>
  projects: ReturnType<typeof summarizeProjects>
  selectedDestinationId: string | null
  selectedProjectId: string | null
  stage: UnitsBrowserStage
  currentDestination: ReturnType<typeof summarizeDestinations>[number] | null
  currentProject: ReturnType<typeof summarizeProjects>[number] | null
  units: LeadraUnit[]
  filters: UnitFilters
  selectedUnitIds: number[]
  batchAction: 'generate' | 'download' | 'share' | null
  onDestinationSelect: (id: string) => void
  onProjectSelect: (id: string) => void
  onBackToDestinations: () => void
  onBackToProjects: () => void
  onFilterChange: <K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) => void
  onResetFilters: () => void
  onToggleUnitSelection: (id: number) => void
  onSelectVisibleUnits: (ids: number[]) => void
  onClearSelection: () => void
  onGenerateSelectedPdfs: () => void
  onDownloadSelectedPdfs: () => void
  onShareSelectedPdfs: () => void
  onOpenUnit: (id: number) => void
}) {
  const { locale, t } = useLocale()
  const visibleScopeKey = JSON.stringify([selectedDestinationId, selectedProjectId, filters])
  const [visibleState, setVisibleState] = useState({ scopeKey: visibleScopeKey, count: unitListPageSize })
  const visibleCount = visibleState.scopeKey === visibleScopeKey ? visibleState.count : unitListPageSize
  const [filtersOpen, setFiltersOpen] = useState(false)
  const visibleUnits = units.slice(0, visibleCount)
  const developerOptions = lookupValues.filter((item) => item.kind === 'developer')
  const destinationOptions = lookupValues.filter((item) => item.kind === 'destination')
  const projectOptions = lookupValues.filter((item) => item.kind === 'project')
  const thumbnailSources = useLookupThumbnailSources(lookupValues)
  const destinationLookupById = new Map(destinationOptions.map((destination) => [destination.id, destination]))
  const projectLookupById = new Map(projectOptions.map((project) => [project.id, project]))
  const unitTypeOptions = Array.from(new Set(units.map((unit) => unit.unitType))).sort((a, b) => compareText(locale, a, b))
  const canUseOwnerPhoneSearch = user.role === 'admin' || user.role === 'sub_admin'
  const activeFilterCount = countActiveUnitFilters(filters)
  const invalidDestination = stage !== 'destinations' && !currentDestination
  const invalidProject = stage === 'units' && (!currentDestination || !currentProject)
  const selectedVisibleCount = visibleUnits.filter((unit) => selectedUnitIds.includes(unit.id)).length
  const batchBusy = batchAction !== null

  return (
    <section className="page-stack page-entrance units-page">
      <div className="section-heading motion-stage" style={motionStyle(0)}>
        <div>
          <p className="eyebrow">{t('units.eyebrow')}</p>
          <h2>{t('units.heading')}</h2>
        </div>
      </div>

      {stage === 'destinations' && (
        <div className="project-grid motion-stage" style={motionStyle(1, 30)}>
          {destinations.map((destination, index) => (
            <InventoryScopeCard
              key={destination.destinationId}
              title={destination.destinationName}
              subtitle={t('units.totalUnits', { count: formatCount(locale, destination.totalUnits) })}
              summary={t('units.summary', { available: formatCount(locale, destination.availableUnits), hold: formatCount(locale, destination.holdUnits), sold: formatCount(locale, destination.soldUnits) })}
              totalUnits={destination.totalUnits}
              availableUnits={destination.availableUnits}
              holdUnits={destination.holdUnits}
              soldUnits={destination.soldUnits}
              thumbnailSrc={thumbnailSources[destinationLookupById.get(destination.destinationId)?.id ?? ''] ?? null}
              index={index}
              delayBase={110}
              onClick={() => onDestinationSelect(destination.destinationId)}
            />
          ))}
          {destinations.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
        </div>
      )}

      {invalidDestination && (
        <section className="content-card motion-stage" style={motionStyle(1, 30)}>
          <EmptyState title="Destination unavailable" body="This destination does not have visible units or no longer exists." />
          <button className="secondary-button" type="button" onClick={onBackToDestinations}>Back to destinations</button>
        </section>
      )}

      {stage === 'projects' && currentDestination && (
        <>
          <div className="action-row motion-stage" style={motionStyle(1, 30)}>
            <button className="secondary-button" type="button" onClick={onBackToDestinations}>Back to destinations</button>
            <span className="integration-badge" dir="auto">{currentDestination.destinationName}</span>
          </div>
          <div className="project-grid compact motion-stage" style={motionStyle(2, 45)}>
            {projects.map((project, index) => (
              <InventoryScopeCard
                key={project.projectId}
                title={project.projectName}
                subtitle={t('units.totalUnits', { count: formatCount(locale, project.totalUnits) })}
                summary={t('units.summary', { available: formatCount(locale, project.availableUnits), hold: formatCount(locale, project.holdUnits), sold: formatCount(locale, project.soldUnits) })}
                totalUnits={project.totalUnits}
                availableUnits={project.availableUnits}
                holdUnits={project.holdUnits}
                soldUnits={project.soldUnits}
                thumbnailSrc={thumbnailSources[projectLookupById.get(project.projectId)?.id ?? ''] ?? null}
                index={index}
                delayBase={130}
                active={selectedProjectId === project.projectId}
                onClick={() => onProjectSelect(project.projectId)}
              />
            ))}
            {projects.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
          </div>
        </>
      )}

      {invalidProject && (
        <section className="content-card motion-stage" style={motionStyle(1, 30)}>
          <EmptyState title="Project unavailable" body="This project does not belong to the selected destination or no longer has visible units." />
          <button className="secondary-button" type="button" onClick={currentDestination ? onBackToProjects : onBackToDestinations}>Back to projects</button>
        </section>
      )}

      {stage === 'units' && currentDestination && currentProject && (
        <>
          <div className="action-row motion-stage" style={motionStyle(1, 30)}>
            <button className="secondary-button" type="button" onClick={onBackToProjects}>Back to projects</button>
            <span className="integration-badge" dir="auto">{currentDestination.destinationName} / {currentProject.projectName}</span>
          </div>

      <section className={`units-filter-shell motion-stage ${filtersOpen ? 'is-open' : ''}`} style={motionStyle(3, 60)}>
        <div className="units-filter-summary">
          <div>
            <p className="eyebrow">{t('units.advancedSearch')}</p>
            <h3>{filtersOpen ? t('units.hideFilters') : t('units.showFilters')}</h3>
            <small>
              {activeFilterCount === 0
                ? t('units.filtersHidden')
                : t('units.activeFilters', { count: activeFilterCount })}
            </small>
          </div>
          <div className="units-filter-actions">
            {activeFilterCount > 0 && (
              <button className="ghost-button compact-action" type="button" onClick={onResetFilters}>
                {t('analytics.reset')}
              </button>
            )}
            <button
              className="secondary-button compact-action"
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="units-advanced-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={17} /> {filtersOpen ? t('units.hideFilters') : t('units.showFilters')}
            </button>
          </div>
        </div>
      </section>

      {filtersOpen && (
      <div id="units-advanced-filters" className="filter-bar advanced-filter-bar motion-stage" style={motionStyle(4, 60)}>
        <div className="filter-section-grid filter-section-grid--primary">
          <label>
            {t('units.unitCode')}
            <input value={filters.unitCode ?? ''} onChange={(event) => onFilterChange('unitCode', event.target.value)} placeholder="NC3BR" dir="auto" />
          </label>
          <ControlledSelectField
            label={t('units.status')}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'available', label: getStatusLabel(locale, 'available') },
              { value: 'hold', label: getStatusLabel(locale, 'hold') },
              { value: 'sold_by_us', label: getStatusLabel(locale, 'sold_by_us') },
              { value: 'sold_by_others', label: getStatusLabel(locale, 'sold_by_others') },
            ]}
            value={filters.status ?? 'all'}
            onValueChange={(value) => onFilterChange('status', value as UnitStatus | 'all')}
          />
          <ControlledSelectField
            label={t('details.developer')}
            options={[{ value: '', label: t('common.all') }, ...developerOptions.map((item) => ({ value: item.id, label: item.label }))]}
            value={filters.developerId ?? ''}
            onValueChange={(value) => onFilterChange('developerId', value || undefined)}
          />
          <ControlledSelectField
            label={t('details.destination')}
            options={[{ value: '', label: t('common.all') }, ...destinationOptions.map((item) => ({ value: item.id, label: item.label }))]}
            value={filters.destinationId ?? ''}
            onValueChange={(value) => onFilterChange('destinationId', value || undefined)}
          />
          <ControlledSelectField
            label={t('details.project')}
            options={[{ value: '', label: t('common.all') }, ...projectOptions.map((item) => ({ value: item.id, label: item.label }))]}
            value={filters.projectId ?? ''}
            onValueChange={(value) => onFilterChange('projectId', value || undefined)}
          />
          <ControlledSelectField
            label={t('details.unitType')}
            options={[{ value: '', label: t('common.all') }, ...unitTypeOptions.map((item) => ({ value: item, label: item }))]}
            value={filters.unitType ?? ''}
            onValueChange={(value) => onFilterChange('unitType', value || undefined)}
          />
        </div>

        <div className="filter-section-list">
          <details className="filter-section">
            <summary>{t('create.specs')}</summary>
            <div className="filter-section-grid">
              <NumberFilter label={t('details.bedrooms')} value={filters.bedrooms === 'all' ? undefined : filters.bedrooms} onChange={(value) => onFilterChange('bedrooms', value ?? 'all')} />
              <NumberFilter label={t('details.bathrooms')} value={filters.bathrooms === 'all' ? undefined : filters.bathrooms} onChange={(value) => onFilterChange('bathrooms', value ?? 'all')} />
              <NumberFilter label={t('details.expectedDelivery')} value={filters.deliveryYear === 'all' ? undefined : filters.deliveryYear} onChange={(value) => onFilterChange('deliveryYear', value ?? 'all')} />
            </div>
          </details>

          <details className="filter-section">
            <summary>{t('units.filterAreas')}</summary>
            <div className="filter-section-grid">
              <RangeFilter label="BUA" from={filters.buaFrom} to={filters.buaTo} onFrom={(value) => onFilterChange('buaFrom', value)} onTo={(value) => onFilterChange('buaTo', value)} />
              <RangeFilter label={t('details.landArea')} from={filters.landAreaFrom} to={filters.landAreaTo} onFrom={(value) => onFilterChange('landAreaFrom', value)} onTo={(value) => onFilterChange('landAreaTo', value)} />
              <RangeFilter label={t('details.gardenArea')} from={filters.gardenAreaFrom} to={filters.gardenAreaTo} onFrom={(value) => onFilterChange('gardenAreaFrom', value)} onTo={(value) => onFilterChange('gardenAreaTo', value)} />
              <RangeFilter label={t('details.terraceArea')} from={filters.terraceAreaFrom} to={filters.terraceAreaTo} onFrom={(value) => onFilterChange('terraceAreaFrom', value)} onTo={(value) => onFilterChange('terraceAreaTo', value)} />
            </div>
          </details>

          <details className="filter-section">
            <summary>{t('units.filterPricing')}</summary>
            <div className="filter-section-grid">
              <RangeFilter label={t('details.totalAmount')} from={filters.priceFrom} to={filters.priceTo} onFrom={(value) => onFilterChange('priceFrom', value)} onTo={(value) => onFilterChange('priceTo', value)} />
              <RangeFilter label="Cash price" from={filters.cashPriceFrom} to={filters.cashPriceTo} onFrom={(value) => onFilterChange('cashPriceFrom', value)} onTo={(value) => onFilterChange('cashPriceTo', value)} />
              <RangeFilter label={t('create.downPayment')} from={filters.downPaymentFrom} to={filters.downPaymentTo} onFrom={(value) => onFilterChange('downPaymentFrom', value)} onTo={(value) => onFilterChange('downPaymentTo', value)} />
              <RangeFilter label={t('details.remainingPayment')} from={filters.remainingPaymentFrom} to={filters.remainingPaymentTo} onFrom={(value) => onFilterChange('remainingPaymentFrom', value)} onTo={(value) => onFilterChange('remainingPaymentTo', value)} />
            </div>
          </details>

          <details className="filter-section">
            <summary>{t('create.payment')}</summary>
            <div className="filter-section-grid">
              <ControlledSelectField
                label={t('details.paymentMethod')}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'cash', label: t('create.cash') },
                  { value: 'installment', label: t('create.installment') },
                ]}
                value={filters.paymentMethod ?? 'all'}
                onValueChange={(value) => onFilterChange('paymentMethod', value as PaymentMethod | 'all')}
              />
              <ControlledSelectField
                label={t('details.installmentType')}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'quarterly', label: t('create.quarterly') },
                  { value: 'semi_annual', label: t('create.semiAnnual') },
                  { value: 'annual', label: t('create.annual') },
                  { value: 'custom', label: t('create.customInstallments') },
                ]}
                value={filters.installmentType ?? 'all'}
                onValueChange={(value) => onFilterChange('installmentType', value as InstallmentType | 'all')}
              />
              <RangeFilter label={t('details.installmentAmount')} from={filters.installmentAmountFrom} to={filters.installmentAmountTo} onFrom={(value) => onFilterChange('installmentAmountFrom', value)} onTo={(value) => onFilterChange('installmentAmountTo', value)} />
            </div>
          </details>
        </div>

        <div className="filter-tail">
          {canUseOwnerPhoneSearch && (
            <label className="filter-owner-phone">
              {t('units.ownerPhone')}
              <input
                value={filters.ownerPhone ?? ''}
                onChange={(event) => onFilterChange('ownerPhone', event.target.value)}
                placeholder={t('units.ownerPhonePlaceholder')}
                dir="auto"
              />
            </label>
          )}
          <button className="secondary-button filter-reset-action" type="button" onClick={onResetFilters}>{t('analytics.reset')}</button>
        </div>
      </div>
      )}

      <div className="batch-pdf-bar motion-stage" style={motionStyle(5, 70)}>
        <strong>{formatCount(locale, selectedVisibleCount)} selected</strong>
        <div className="batch-pdf-actions">
          <button className="ghost-button compact-action" type="button" onClick={() => onSelectVisibleUnits(visibleUnits.map((unit) => unit.id))} disabled={visibleUnits.length === 0 || batchBusy}>
            Select visible
          </button>
          <button className="secondary-button compact-action" type="button" aria-label="Generate selected PDFs" onClick={onGenerateSelectedPdfs} disabled={selectedVisibleCount === 0 || batchBusy}>
            <FileText size={14} /> {batchAction === 'generate' ? 'Generating...' : 'Generate'}
          </button>
          <button className="secondary-button compact-action" type="button" aria-label="Download selected PDFs" onClick={onDownloadSelectedPdfs} disabled={selectedVisibleCount === 0 || batchBusy}>
            <Download size={14} /> {batchAction === 'download' ? 'Downloading...' : 'Download'}
          </button>
          <button className="secondary-button compact-action" type="button" aria-label="Share selected PDFs" onClick={onShareSelectedPdfs} disabled={selectedVisibleCount === 0 || batchBusy}>
            <Share2 size={14} /> {batchAction === 'share' ? 'Sharing...' : 'Share'}
          </button>
          <button className="ghost-button compact-action" type="button" onClick={onClearSelection} disabled={selectedVisibleCount === 0 || batchBusy}>
            <X size={14} /> Clear
          </button>
        </div>
      </div>

      <section className="unit-list motion-list" key={`${selectedDestinationId ?? 'all'}-${selectedProjectId ?? 'all'}-${JSON.stringify(filters)}`}>
        {units.length === 0 && <EmptyState title={t('units.noMatchesTitle')} body={t('units.noMatchesBody')} />}
        {visibleUnits.map((unit, index) => (
          <UnitListRow
            key={unit.id}
            user={user}
            unit={unit}
            index={index}
            selected={selectedUnitIds.includes(unit.id)}
            onSelectionChange={() => onToggleUnitSelection(unit.id)}
            onOpen={() => onOpenUnit(unit.id)}
          />
        ))}
        {visibleUnits.length < units.length && (
          <button
            className="secondary-button list-load-more"
            type="button"
            onClick={() =>
              setVisibleState((current) => ({
                scopeKey: visibleScopeKey,
                count: Math.min((current.scopeKey === visibleScopeKey ? current.count : unitListPageSize) + unitListPageSize, units.length),
              }))
            }
          >
            Show {formatCount(locale, Math.min(unitListPageSize, units.length - visibleUnits.length))} more of {formatCount(locale, units.length)}
          </button>
        )}
      </section>
        </>
      )}
    </section>
  )
}


function InventoryScopeCard({
  title,
  subtitle,
  summary,
  totalUnits,
  availableUnits,
  holdUnits,
  soldUnits,
  thumbnailSrc,
  index,
  delayBase,
  active = false,
  onClick,
}: {
  title: string
  subtitle: string
  summary: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
  thumbnailSrc?: string | null
  index: number
  delayBase: number
  active?: boolean
  onClick: () => void
}) {
  const safeTotal = Math.max(totalUnits, 1)
  const availablePercent = Math.max(8, Math.round((availableUnits / safeTotal) * 100))
  const holdPercent = Math.max(6, Math.round((holdUnits / safeTotal) * 100))
  const soldPercent = Math.max(6, Math.round((soldUnits / safeTotal) * 100))
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <button
      className={`project-card inventory-scope-card motion-stage ${active ? 'active' : ''}`}
      type="button"
      style={{
        ...motionStyle(index, delayBase),
        '--available-share': `${availablePercent}%`,
        '--hold-share': `${holdPercent}%`,
        '--sold-share': `${soldPercent}%`,
      } as CSSProperties}
      onClick={onClick}
    >
      <span className="scope-card-visual" aria-hidden="true">
        {thumbnailSrc ? <img src={thumbnailSrc} alt="" loading="lazy" /> : <span className="scope-card-mark">{initials || title[0] || 'L'}</span>}
        <span className="scope-card-path" />
      </span>
      <span className="scope-card-copy">
        <strong dir="auto">{title}</strong>
        <span>{subtitle}</span>
        <small>{summary}</small>
      </span>
      <span className="scope-card-meter" aria-hidden="true">
        <span className="scope-card-meter-segment available" />
        <span className="scope-card-meter-segment hold" />
        <span className="scope-card-meter-segment sold" />
      </span>
    </button>
  )
}

function NumberFilter({ label, value, onChange }: { label: string; value?: number; onChange: (value: number | undefined) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value ?? ''} onChange={(event) => onChange(parseOptionalNumber(event.target.value))} />
    </label>
  )
}

function RangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string
  from?: number
  to?: number
  onFrom: (value: number | undefined) => void
  onTo: (value: number | undefined) => void
}) {
  return (
    <div className="range-filter">
      <span>{label}</span>
      <input aria-label={`${label} from`} type="number" value={from ?? ''} placeholder="From" onChange={(event) => onFrom(parseOptionalNumber(event.target.value))} />
      <input aria-label={`${label} to`} type="number" value={to ?? ''} placeholder="To" onChange={(event) => onTo(parseOptionalNumber(event.target.value))} />
    </div>
  )
}

export const UnitListRow = memo(function UnitListRow({
  user,
  unit,
  onOpen,
  onSelectionChange,
  selected = false,
  index = 0,
}: {
  user: LeadraUser
  unit: LeadraUnit
  onOpen: () => void
  onSelectionChange?: () => void
  selected?: boolean
  index?: number
}) {
  const { locale, t } = useLocale()
  const thumbnail = getThumbnailMedia(unit.media)

  return (
    <div className={`unit-row motion-stage ${onSelectionChange ? 'selectable' : ''} ${selected ? 'selected' : ''}`} style={motionStyle(index)}>
      {onSelectionChange && (
        <label className="unit-row-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectionChange}
            aria-label={`Select ${unit.unitCode}`}
          />
        </label>
      )}
      <button className="unit-row-open" type="button" aria-label={t('units.openUnit', { unitCode: unit.unitCode })} onClick={onOpen}>
        <span className="thumb">{thumbnail ? <img src={thumbnail.url} alt="" loading="lazy" decoding="async" /> : <ImageIcon />}</span>
        <span className="unit-row-copy">
          <strong>{unit.unitCode}</strong>
          <p dir="auto">{unit.projectName} / {unit.unitType} / {t('units.areaBua', { bua: formatCount(locale, unit.bua) })}</p>
          <small dir="auto">{unit.createdByName}</small>
          {canViewOwnerData(user, unit) && <small dir="auto">{unit.originalOwnerPhone}</small>}
        </span>
        <span className={`status-pill motion-status-pill ${unit.status}`}>{getStatusLabel(locale, unit.status)}</span>
      </button>
    </div>
  )
})
