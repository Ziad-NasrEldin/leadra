import { Archive, Download, FileText, Share2, Star, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { buildPaymentTimetable, calculateDisplayedPaymentTotals, canAddAdminManagerNote, canArchiveUnit, canEditAnyUnitDetails, canEditNonOwnerUnitDetails, canEditOwnerFields, canEditUnitCommission, canEditUnitPricing, canManageUnitSpecialStatus, canUseUnitOperationalActions, canViewOwnerData, canViewSalesSensitiveData, formatCurrency, formatDeliveryExpectancy, getApplicableUnitAreaFields, getOwnerPhoneCountryMeta, getOwnerPhoneCountryOptions, PRD_FLOOR_OPTIONS, PRD_UNIT_TYPES } from '../../lib/domain'
import { formatCount, formatDateTime, getPaymentMethodLabel, getRoleLabel, getStatusLabel, useLocale, type LocaleCode } from '../../lib/i18n'
import type { InstallmentType, LeadraMediaFile, LeadraUnit, LeadraUser, LookupValue, PaymentMethod, UnitStatus } from '../../lib/types'
import { EmptyState, InfoPanel, NativeLookupSelect, NamedSelectField, NumberField, OwnerPhoneField, ReadOnlyField, RequiredLabel, TextSkeleton } from '../../components/LeadraUi'
import { countInstallmentsBetweenMonths, formatMonthYear, getInstallmentTypeLabel, getUnitCustomInstallmentText, getUnitInstallmentEndMonth, getUnitInstallmentStartMonth, toMonthInputValue } from '../shared/formUtils'
import { motionStyle } from '../shared/motion'

type UnitDetailsPageProps = {
  user: LeadraUser
  unit: LeadraUnit
  lookupValues: LookupValue[]
  onArchive: () => void
  onSpecialChange: (special: boolean) => void
  onUpdateUnit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onStatusChange: (status: UnitStatus) => void
  onGeneratePdf: () => void
  onDownloadPdf: () => void
  onSharePdf: () => void
  onCopyShareLink: () => void
  onCopySocialCopy: () => void
  pdfGenerating: boolean
  pdfSharing: boolean
  pdfReady: boolean
  statusUpdating: boolean
  specialUpdating: boolean
  statusActionFeedback: { status: UnitStatus; state: 'saving' | 'saved' } | null
  onSaveNote: (content: string) => void
  onDeleteNote: () => void
  onRemoveMedia: (mediaId: string) => void
  onMediaPdfVisibilityChange: (mediaId: string, includeInPdf: boolean) => void
  onMediaDownload: (file: LeadraMediaFile) => void
  removingMediaId: string | null
  downloadingMediaId: string | null
}

export function UnitDetailsPage({
  user,
  unit,
  lookupValues,
  onArchive,
  onSpecialChange,
  onUpdateUnit,
  onStatusChange,
  onGeneratePdf,
  onDownloadPdf,
  onSharePdf,
  onCopyShareLink,
  onCopySocialCopy,
  pdfGenerating,
  pdfSharing,
  pdfReady,
  statusUpdating,
  specialUpdating,
  statusActionFeedback,
  onSaveNote,
  onDeleteNote,
  onRemoveMedia,
  onMediaPdfVisibilityChange,
  onMediaDownload,
  removingMediaId,
  downloadingMediaId,
}: UnitDetailsPageProps) {
  const { locale, t } = useLocale()
  const ownerAllowed = canViewOwnerData(user, unit)
  const canEditUnit = canEditAnyUnitDetails(user, unit)
  const canManageSpecial = canManageUnitSpecialStatus(user, unit)
  const canUseOperations = canUseUnitOperationalActions(user, unit)
  const [sharedNoteState, setSharedNoteState] = useState({ unitId: unit.id, value: unit.adminManagerNotes[0]?.content ?? '' })
  const sharedNote = sharedNoteState.unitId === unit.id ? sharedNoteState.value : unit.adminManagerNotes[0]?.content ?? ''
  const setSharedNote = (value: string) => setSharedNoteState({ unitId: unit.id, value })
  const [editMode, setEditMode] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [showDetailDepth, setShowDetailDepth] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowDetailDepth(true), 1800)
    return () => window.clearTimeout(timeout)
  }, [unit.id])

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    setEditSaving(true)
    const saved = await onUpdateUnit(event)
    setEditSaving(false)
    if (saved) setEditMode(false)
  }

  return (
    <section className="page-stack page-entrance details-page">
      <UnitDetailsHero unit={unit} statusActionFeedback={statusActionFeedback} />
      <UnitDetailsActions
        canEditUnit={canEditUnit}
        canManageSpecial={canManageSpecial}
        canUseOperations={canUseOperations}
        editMode={editMode}
        pdfGenerating={pdfGenerating}
        pdfReady={pdfReady}
        pdfSharing={pdfSharing}
        specialUpdating={specialUpdating}
        statusActionFeedback={statusActionFeedback}
        statusUpdating={statusUpdating}
        unit={unit}
        user={user}
        onArchive={onArchive}
        onCopyShareLink={onCopyShareLink}
        onCopySocialCopy={onCopySocialCopy}
        onDownloadPdf={onDownloadPdf}
        onEditToggle={() => setEditMode((value) => !value)}
        onGeneratePdf={onGeneratePdf}
        onSharePdf={onSharePdf}
        onSpecialChange={onSpecialChange}
        onStatusChange={onStatusChange}
      />
      {editMode && (
        <UnitDetailsEditForm
          lookupValues={lookupValues}
          saving={editSaving}
          unit={unit}
          user={user}
          onCancel={() => setEditMode(false)}
          onSubmit={submitEdit}
        />
      )}
      {showDetailDepth ? (
        <UnitDetailsDeepSections
          locale={locale}
          t={t}
          user={user}
          unit={unit}
          ownerAllowed={ownerAllowed}
          sharedNote={sharedNote}
          setSharedNote={setSharedNote}
          onSaveNote={onSaveNote}
          onDeleteNote={onDeleteNote}
          onRemoveMedia={onRemoveMedia}
          onMediaPdfVisibilityChange={onMediaPdfVisibilityChange}
          onMediaDownload={onMediaDownload}
          removingMediaId={removingMediaId}
          downloadingMediaId={downloadingMediaId}
          canUseOperations={canUseOperations}
        />
      ) : (
        <section className="content-card motion-stage details-deferred-card" style={motionStyle(2, 70)}>
          <p className="eyebrow">{t('details.preparingDetails')}</p>
          <h2>{t('details.mainInfo')}</h2>
          <DetailsLoadingSkeleton />
        </section>
      )}
    </section>
  )
}

function UnitDetailsHero({
  unit,
  statusActionFeedback,
}: {
  unit: LeadraUnit
  statusActionFeedback: { status: UnitStatus; state: 'saving' | 'saved' } | null
}) {
  const { locale, t } = useLocale()
  const heroFacts: [string, string][] = [
    [t('create.bua'), `${formatCount(locale, unit.bua)} m²`],
    [t('details.totalAmount'), formatCurrency(unit.totalAmount, locale)],
    [t('details.expectedDelivery'), formatDeliveryExpectancy(unit, locale)],
  ]

  return (
    <div className="details-hero motion-stage motion-hero" style={motionStyle(0)}>
      <div>
        <p className="eyebrow">{t('details.eyebrow')}</p>
        <h2>{unit.unitCode}</h2>
        <p dir="auto">{unit.projectName} / {unit.destinationName} / {unit.unitType}</p>
      </div>
      <div className="details-hero-summary">
        <span className={`status-pill motion-status-pill ${unit.status} ${statusActionFeedback ? 'status-pill-live' : ''}`}>
          {getStatusLabel(locale, unit.status)}
        </span>
        <dl className="details-hero-facts">
          {heroFacts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function UnitDetailsActions({
  canEditUnit,
  canManageSpecial,
  canUseOperations,
  editMode,
  pdfGenerating,
  pdfReady,
  pdfSharing,
  specialUpdating,
  statusActionFeedback,
  statusUpdating,
  unit,
  user,
  onArchive,
  onCopyShareLink,
  onCopySocialCopy,
  onDownloadPdf,
  onEditToggle,
  onGeneratePdf,
  onSharePdf,
  onSpecialChange,
  onStatusChange,
}: {
  canEditUnit: boolean
  canManageSpecial: boolean
  canUseOperations: boolean
  editMode: boolean
  pdfGenerating: boolean
  pdfReady: boolean
  pdfSharing: boolean
  specialUpdating: boolean
  statusActionFeedback: { status: UnitStatus; state: 'saving' | 'saved' } | null
  statusUpdating: boolean
  unit: LeadraUnit
  user: LeadraUser
  onArchive: () => void
  onCopyShareLink: () => void
  onCopySocialCopy: () => void
  onDownloadPdf: () => void
  onEditToggle: () => void
  onGeneratePdf: () => void
  onSharePdf: () => void
  onSpecialChange: (special: boolean) => void
  onStatusChange: (status: UnitStatus) => void
}) {
  const { locale, t } = useLocale()
  const statusFeedbackText = statusActionFeedback
    ? t(statusActionFeedback.state === 'saving' ? 'details.statusSaving' : 'details.statusSaved', {
        status: getStatusLabel(locale, statusActionFeedback.status),
      })
    : null

  return (
    <div className="details-actions motion-stage" style={motionStyle(1, 40)}>
      {canUseOperations && <div className="details-action-group">
        <span>{t('details.status')}</span>
        <div className="action-row wrap">
          <button className={`secondary-button status-action-button hold ${statusActionFeedback?.status === 'hold' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'hold'} onClick={() => onStatusChange('hold')}>{statusActionFeedback?.status === 'hold' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'hold') }) : t('details.markHold')}</button>
          <button className={`secondary-button status-action-button sold ${statusActionFeedback?.status === 'sold_by_us' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'sold_by_us'} onClick={() => onStatusChange('sold_by_us')}>{statusActionFeedback?.status === 'sold_by_us' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'sold_by_us') }) : t('details.markSoldByUs')}</button>
          <button className={`secondary-button status-action-button sold ${statusActionFeedback?.status === 'sold_by_others' ? 'is-active' : ''}`} type="button" disabled={statusUpdating || unit.status === 'sold_by_others'} onClick={() => onStatusChange('sold_by_others')}>{statusActionFeedback?.status === 'sold_by_others' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'sold_by_others') }) : t('details.markSoldByOthers')}</button>
          {unit.status !== 'available' && <button className={`secondary-button status-action-button available ${statusActionFeedback?.status === 'available' ? 'is-active' : ''}`} type="button" disabled={statusUpdating} onClick={() => onStatusChange('available')}>{statusActionFeedback?.status === 'available' && statusActionFeedback.state === 'saving' ? t('details.statusMarking', { status: getStatusLabel(locale, 'available') }) : t('details.clearStatus')}</button>}
        </div>
        {statusFeedbackText && <p className={`status-action-feedback ${statusActionFeedback?.state === 'saving' ? 'is-saving' : 'is-saved'}`} role="status" aria-live="polite">{statusFeedbackText}</p>}
      </div>}
      <div className="details-action-group">
        <span>{t('details.generateBrief')}</span>
        <div className="action-row wrap">
          <button className="primary-button" type="button" onClick={onGeneratePdf} disabled={pdfGenerating || pdfSharing}>
            <FileText size={18} /> {pdfGenerating ? t('details.preparingPdf') : pdfReady ? t('details.regeneratePdf') : t('details.generateBrief')}
          </button>
          <button className="secondary-button" type="button" onClick={onDownloadPdf} disabled={!pdfReady || pdfGenerating || pdfSharing}>
            <Download size={18} /> {t('details.downloadPdf')}
          </button>
          <button className="secondary-button" type="button" onClick={onSharePdf} disabled={!pdfReady || pdfGenerating || pdfSharing}>
            <Share2 size={18} /> {pdfSharing ? t('details.preparingShare') : t('details.sharePdf')}
          </button>
          <button className="secondary-button" type="button" onClick={onCopyShareLink}>
            <Share2 size={18} /> {t('details.shareLink')}
          </button>
          {unit.isSpecial && canManageSpecial && (
            <button className="secondary-button" type="button" onClick={onCopySocialCopy}>
              <Share2 size={18} /> Social copy
            </button>
          )}
          {canEditUnit && (
            <button className="secondary-button" type="button" onClick={onEditToggle}>
              {editMode ? t('details.cancelEdit') : t('details.editUnit')}
            </button>
          )}
          {canManageSpecial && (
            <button
              className={`secondary-button special-action-button ${unit.isSpecial ? 'is-active' : ''}`}
              type="button"
              onClick={() => onSpecialChange(!unit.isSpecial)}
              disabled={specialUpdating}
            >
              <Star size={18} fill={unit.isSpecial ? 'currentColor' : 'none'} />
              {specialUpdating ? t('details.specialSaving') : unit.isSpecial ? t('details.removeSpecial') : t('details.markSpecial')}
            </button>
          )}
          {canArchiveUnit(user, unit) && <button className="danger-button" type="button" onClick={onArchive}><Archive size={18} /> {t('details.archive')}</button>}
        </div>
      </div>
    </div>
  )
}

function UnitDetailsEditForm({
  lookupValues,
  saving,
  unit,
  user,
  onCancel,
  onSubmit,
}: {
  lookupValues: LookupValue[]
  saving: boolean
  unit: LeadraUnit
  user: LeadraUser
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { locale, t } = useLocale()
  const canEditNonOwner = canEditNonOwnerUnitDetails(user, unit)
  const canEditOwner = canEditOwnerFields(user, unit)
  const canEditPricing = canEditUnitPricing(user, unit)
  const canEditCommission = canEditUnitCommission(user, unit)
  const canEditPaymentPlan = canEditPricing
  const [unitType, setUnitType] = useState(unit.unitType)
  const [floor, setFloor] = useState(unit.floor || 'Ground')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(unit.paymentMethod)
  const [installmentType, setInstallmentType] = useState<InstallmentType>(unit.installmentType ?? 'quarterly')
  const [totalAmount, setTotalAmount] = useState(unit.totalAmount)
  const [downPayment, setDownPayment] = useState(unit.downPayment ?? 0)
  const [installmentStartMonthValue, setInstallmentStartMonthValue] = useState(toMonthInputValue(getUnitInstallmentStartMonth(unit)))
  const [installmentEndMonthValue, setInstallmentEndMonthValue] = useState(toMonthInputValue(getUnitInstallmentEndMonth(unit)))
  const [ownerCountryCode, setOwnerCountryCode] = useState(unit.countryCode ?? '+20')
  const [ownerPhone, setOwnerPhone] = useState(unit.originalOwnerPhone ?? '')
  const [maintenancePaid, setMaintenancePaid] = useState(unit.maintenancePaid ?? false)
  const areaFields = getApplicableUnitAreaFields(unitType, floor)
  const lookupFinishOptions = lookupValues
    .filter((item) => item.kind === 'finish')
    .map((item) => ({ value: item.label, label: item.label }))
  const finishOptions = lookupFinishOptions.some((option) => option.value === unit.finish)
    ? lookupFinishOptions
    : [{ value: unit.finish, label: unit.finish }, ...lookupFinishOptions]
  const ownerPhoneCountryOptions = getOwnerPhoneCountryOptions(locale)
  const selectedOwnerPhoneCountry = getOwnerPhoneCountryMeta(ownerCountryCode, locale)
  const deliveryYearOptions = Array.from({ length: 10 }, (_, index) => String(2026 + index))
  const installmentStartMonth = getUnitInstallmentStartMonth(unit)
  const installmentEndMonth = getUnitInstallmentEndMonth(unit)
  const customInstallmentText = getUnitCustomInstallmentText(unit)
  const hasStoredInstallmentPeriod = Boolean(installmentStartMonth && installmentEndMonth)
  const editRemainingPayment = paymentMethod === 'installment' ? Math.max(0, totalAmount - downPayment) : null
  const editInstallmentCount = countInstallmentsBetweenMonths(installmentType, installmentStartMonthValue, installmentEndMonthValue)
  const editInstallmentAmount = paymentMethod === 'installment' && installmentType !== 'custom' && editRemainingPayment != null && editInstallmentCount
    ? Math.round((editRemainingPayment / editInstallmentCount) * 100) / 100
    : null

  return (
    <section className="content-card motion-stage details-edit-card" style={motionStyle(2, 70)} aria-labelledby="unit-edit-heading">
      <div className="section-heading details-compact-heading">
        <div>
          <p className="eyebrow">{t('details.editMode')}</p>
          <h2 id="unit-edit-heading">{t('details.editUnit')}</h2>
        </div>
      </div>
      <form className="unit-form details-edit-form" onSubmit={onSubmit}>
        <fieldset disabled={!canEditNonOwner || saving}>
          <legend>{t('create.legend.property')}</legend>
          <NativeLookupSelect name="destinationId" label={t('create.destination')} values={lookupValues.filter((item) => item.kind === 'destination')} defaultValue={unit.destinationId} required />
          <NativeLookupSelect name="developerId" label={t('create.developer')} values={lookupValues.filter((item) => item.kind === 'developer')} defaultValue={unit.developerId} required />
          <NativeLookupSelect name="projectId" label={t('create.project')} values={lookupValues.filter((item) => item.kind === 'project')} defaultValue={unit.projectId} required />
          <NamedSelectField
            name="unitType"
            label={t('create.unitType')}
            options={PRD_UNIT_TYPES.map((item) => ({ value: item, label: item }))}
            value={unitType}
            required
            onValueChange={(nextType) => {
              setUnitType(nextType)
              if (!getApplicableUnitAreaFields(nextType, floor).showFloor) setFloor('Ground')
            }}
          />
          <NumberField name="bua" label={t('create.bua')} defaultValue={unit.bua} min={1} required />
          {areaFields.showLandArea && <NumberField name="landArea" label={t('create.landArea')} defaultValue={unit.landArea ?? 0} min={0} required />}
          {areaFields.showFloor && (
            <NamedSelectField
              name="floor"
              label={t('create.floor')}
              options={PRD_FLOOR_OPTIONS.map((item) => ({ value: item, label: item === 'Ground' ? t('create.ground') : item }))}
              value={floor}
              required
              onValueChange={setFloor}
            />
          )}
          {areaFields.showGardenArea && <NumberField name="gardenArea" label={t('create.gardenArea')} defaultValue={unit.gardenArea ?? 0} min={0} />}
          {areaFields.showTerraceArea && <NumberField name="terraceArea" label={t('create.terraceArea')} defaultValue={unit.terraceArea ?? 0} min={0} required />}
          <NativeLookupSelect name="viewId" label={t('create.view')} values={lookupValues.filter((item) => item.kind === 'view')} defaultValue={unit.viewId} />
          <NumberField name="bedrooms" label={t('create.bedrooms')} defaultValue={unit.bedrooms} min={1} max={10} required />
          <NumberField name="bathrooms" label={t('create.bathrooms')} defaultValue={unit.bathrooms} min={1} max={10} required />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked={unit.elevator} /> {t('create.elevator')}</label>
          <NamedSelectField
            name="furnished"
            label={t('create.furnished')}
            defaultValue={String(unit.furnished)}
            options={[
              { value: 'true', label: t('create.furnishedOption') },
              { value: 'false', label: t('create.unfurnishedOption') },
            ]}
          />
          <NamedSelectField
            name="finish"
            label={t('create.finish')}
            defaultValue={unit.finish}
            required
            options={finishOptions}
          />
          <NamedSelectField
            name="deliveryYear"
            label={t('create.deliveryDate')}
            defaultValue={String(unit.deliveryExpectancy.year)}
            required
            options={deliveryYearOptions.map((year) => ({ value: year, label: year }))}
          />
          <label className="wide-field">
            {t('create.salesNotes')}
            <textarea name="salesNotes" defaultValue={unit.salesNotes} dir="auto" />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('create.legend.payment')}</legend>
          <NamedSelectField
            name="paymentMethod"
            label={t('create.paymentMethod')}
            disabled={!canEditPaymentPlan || saving}
            options={[
              { value: 'cash', label: getPaymentMethodLabel(locale, 'cash') },
              { value: 'installment', label: getPaymentMethodLabel(locale, 'installment') },
            ]}
            value={paymentMethod}
            required
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
          <label>
            <RequiredLabel label={t('create.totalAmount')} required />
            <input
              name="totalAmount"
              role="spinbutton"
              type="number"
              min={0}
              step="0.01"
              value={totalAmount}
              disabled={!canEditPricing || saving}
              required={canEditPricing}
              onChange={(event) => setTotalAmount(Number(event.target.value) || 0)}
            />
          </label>
          <label className="toggle-line">
            <input
              name="maintenancePaid"
              type="checkbox"
              checked={maintenancePaid}
              disabled={!canEditPricing || saving}
              onChange={(event) => setMaintenancePaid(event.target.checked)}
            />{' '}
            {t('create.maintenancePaid')}
          </label>
          {!maintenancePaid && (
            <>
              <label>
                <RequiredLabel label={t('create.maintenanceCost')} required={canEditPricing} />
                <input name="maintenanceCost" type="number" min={0} step="0.01" defaultValue={unit.maintenanceCost ?? 0} disabled={!canEditPricing || saving} required={canEditPricing} />
              </label>
              <label>
                {t('create.maintenanceDueDate')}
                <input name="maintenanceDueDate" type="date" defaultValue={unit.maintenanceDueDate ?? ''} disabled={!canEditPricing || saving} />
              </label>
            </>
          )}
          {paymentMethod === 'installment' && (
            <label>
              <RequiredLabel label={t('create.downPayment')} required={canEditPaymentPlan} />
               <input
                 name="downPayment"
                 type="number"
                 min={0}
                 max={totalAmount}
                 value={downPayment}
                 disabled={!canEditPaymentPlan || saving}
                 required={canEditPaymentPlan}
                 onChange={(event) => setDownPayment(Number(event.target.value) || 0)}
               />
            </label>
          )}
          <ReadOnlyField label={t('details.remainingPayment')} value={editRemainingPayment == null ? t('common.notSet') : formatCurrency(editRemainingPayment, locale)} />
          {paymentMethod === 'installment' && (
            <>
              <NamedSelectField
                name="installmentType"
                label={t('details.installmentType')}
                disabled={!canEditPaymentPlan || saving}
                options={[
                  { value: 'monthly', label: t('create.monthly') },
                  { value: 'quarterly', label: t('create.quarterly') },
                  { value: 'semi_annual', label: t('create.semiAnnual') },
                  { value: 'annual', label: t('create.annual') },
                  { value: 'custom', label: t('create.customInstallments') },
                ]}
                value={installmentType}
                required
                onValueChange={(value) => setInstallmentType(value as InstallmentType)}
              />
              {installmentType === 'custom' ? (
                <label className="wide-field">
                  <RequiredLabel label={t('create.customInstallmentText')} required={canEditPricing} />
                  <textarea name="customInstallmentText" defaultValue={customInstallmentText ?? ''} disabled={!canEditPricing || saving} required={canEditPricing} dir="auto" />
                </label>
              ) : (
                <>
                  <label>
                    <RequiredLabel label={t('create.installmentStartMonth')} required={canEditPricing && hasStoredInstallmentPeriod} />
                    <input
                      name="installmentStartMonth"
                      type="month"
                      value={installmentStartMonthValue}
                      disabled={!canEditPricing || saving}
                      required={canEditPricing && hasStoredInstallmentPeriod}
                      onChange={(event) => setInstallmentStartMonthValue(event.target.value)}
                    />
                  </label>
                  <label>
                    <RequiredLabel label={t('create.installmentEndMonth')} required={canEditPricing && hasStoredInstallmentPeriod} />
                    <input
                      name="installmentEndMonth"
                      type="month"
                      value={installmentEndMonthValue}
                      disabled={!canEditPricing || saving}
                      required={canEditPricing && hasStoredInstallmentPeriod}
                      onChange={(event) => setInstallmentEndMonthValue(event.target.value)}
                    />
                  </label>
                  {!hasStoredInstallmentPeriod && (
                    <ReadOnlyField label={t('details.installmentYears')} value={unit.installmentYears ? formatCount(locale, unit.installmentYears) : t('common.notSet')} />
                  )}
                  <ReadOnlyField label={t('details.installmentAmount')} value={editInstallmentAmount == null ? t('common.notSet') : formatCurrency(editInstallmentAmount, locale)} />
                  <label>
                    Installment due day
                    <input name="installmentDueDay" type="number" min={1} max={31} defaultValue={unit.installmentDueDay ?? 1} disabled={!canEditPaymentPlan || saving} required={canEditPaymentPlan} />
                  </label>
                </>
              )}
            </>
          )}
          <label>
            <RequiredLabel label={t('details.commission')} required />
            <input name="commissionPercentage" type="number" min={0} step="0.01" defaultValue={unit.commissionPercentage} disabled={!canEditCommission || saving} required={canEditCommission} />
          </label>
        </fieldset>

        <fieldset disabled={!canEditOwner || saving}>
          <legend>{t('details.ownerData')}</legend>
          <label>
            <RequiredLabel label={t('create.ownerName')} required />
            <input name="ownerName" defaultValue={unit.originalOwnerName ?? ''} required={canEditOwner} dir="auto" />
          </label>
          {canEditOwner ? (
            <OwnerPhoneField
              countryCode={ownerCountryCode}
              countryOptions={ownerPhoneCountryOptions}
              hint={t('create.ownerPhoneHint', { country: selectedOwnerPhoneCountry.label, example: selectedOwnerPhoneCountry.placeholder })}
              ownerPhone={ownerPhone}
              placeholder={selectedOwnerPhoneCountry.placeholder}
              onCountryCodeChange={setOwnerCountryCode}
              onOwnerPhoneChange={setOwnerPhone}
            />
          ) : (
            <>
              <ReadOnlyField label={t('create.countryCode')} value={unit.countryCode ?? t('common.notSet')} />
              <ReadOnlyField label={t('create.ownerPhone')} value={unit.originalOwnerPhone ?? t('common.notSet')} />
            </>
          )}
        </fieldset>

        <p className="status-action-feedback is-saving" role="status" aria-live="polite">
          {saving ? t('details.editSaving') : t('details.editReady')}
        </p>
        <div className="note-editor-actions">
          <button className="primary-button" type="submit" disabled={saving}>{saving ? t('common.saving') : t('details.saveUnitChanges')}</button>
          <button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </form>
    </section>
  )
}

function UnitDetailsDeepSections({
  locale,
  t,
  user,
  unit,
  ownerAllowed,
  sharedNote,
  setSharedNote,
  onSaveNote,
  onDeleteNote,
  onRemoveMedia,
  onMediaPdfVisibilityChange,
  onMediaDownload,
  removingMediaId,
  downloadingMediaId,
  canUseOperations,
}: {
  locale: LocaleCode
  t: ReturnType<typeof useLocale>['t']
  user: LeadraUser
  unit: LeadraUnit
  ownerAllowed: boolean
  sharedNote: string
  setSharedNote: (value: string) => void
  onSaveNote: (content: string) => void
  onDeleteNote: () => void
  onRemoveMedia: (mediaId: string) => void
  onMediaPdfVisibilityChange: (mediaId: string, includeInPdf: boolean) => void
  onMediaDownload: (file: LeadraMediaFile) => void
  removingMediaId: string | null
  downloadingMediaId: string | null
  canUseOperations: boolean
}) {
  const installmentSchedule = buildPaymentTimetable(unit, locale)
  const installmentStartMonth = getUnitInstallmentStartMonth(unit)
  const installmentEndMonth = getUnitInstallmentEndMonth(unit)
  const customInstallmentText = getUnitCustomInstallmentText(unit)
  const hasInstallmentPeriod = Boolean(installmentStartMonth && installmentEndMonth)
  const paymentTotals = calculateDisplayedPaymentTotals(unit)
  const paidInstallmentTotal = installmentSchedule.reduce((total, row) => total + (row.paid ? row.amount : 0), 0)
  const timetableRemaining = paymentTotals.displayedRemainingAmount
  const areaFields = getApplicableUnitAreaFields(unit.unitType, unit.floor)
  const canRemoveMedia = canUseOperations && canEditNonOwnerUnitDetails(user, unit)
  const mainInfoRows: [string, string | number | null][] = [
    [t('details.unitCode'), unit.unitCode],
    [t('details.uploader'), unit.createdByName],
    [t('details.status'), getStatusLabel(locale, unit.status)],
    [t('details.destination'), unit.destinationName],
    [t('details.developer'), unit.developerName],
    [t('details.project'), unit.projectName],
    [t('details.unitType'), unit.unitType],
    [t('create.bua'), `${formatCount(locale, unit.bua)} m²`],
  ]
  if (areaFields.showLandArea) mainInfoRows.push([t('details.landArea'), unit.landArea ? `${formatCount(locale, unit.landArea)} m²` : t('common.notSet')])
  if (areaFields.showFloor) mainInfoRows.push([t('details.floor'), unit.floor])
  if (areaFields.showGardenArea) mainInfoRows.push([t('details.gardenArea'), unit.gardenArea ? `${formatCount(locale, unit.gardenArea)} m²` : t('common.notSet')])
  if (areaFields.showTerraceArea) mainInfoRows.push([t('details.terraceArea'), unit.terraceArea ? `${formatCount(locale, unit.terraceArea)} m²` : t('common.notSet')])
  mainInfoRows.push(
    [t('details.view'), unit.viewName],
    [t('details.bedrooms'), formatCount(locale, unit.bedrooms)],
    [t('details.bathrooms'), formatCount(locale, unit.bathrooms)],
    [t('details.elevator'), unit.elevator ? t('common.with') : t('common.without')],
  )
  if (unit.furnished) {
    mainInfoRows.push([t('details.furnishingStatus'), t('create.furnishedOption')])
  }
  mainInfoRows.push([`${t('details.finishType')} *`, unit.finish])
  const pricingRows: [string, string | number | null][] = [
    [t('details.paymentMethod'), getPaymentMethodLabel(locale, unit.paymentMethod)],
    [t('details.totalAmount'), formatCurrency(unit.totalAmount, locale)],
    ...(unit.paymentMethod === 'installment'
      ? [
          [t('create.downPayment'), formatCurrency(paymentTotals.displayedPaidAmount, locale)] as [string, string | number | null],
          [t('details.remainingPayment'), formatCurrency(paymentTotals.displayedRemainingAmount, locale)] as [string, string | number | null],
        ]
      : [
          [t('details.remainingPayment'), formatCurrency(paymentTotals.displayedRemainingAmount, locale)] as [string, string | number | null],
        ]),
    [t('details.maintenancePaid'), unit.maintenancePaid ? t('common.yes') : t('common.no')],
    ...(!unit.maintenancePaid
      ? [
          [t('details.maintenanceCost'), formatCurrency(unit.maintenanceCost ?? null, locale)] as [string, string | number | null],
          [t('details.maintenanceAllocation'), t('details.maintenanceInRemainingAmount')] as [string, string | number | null],
        ]
      : []),
  ]
  const installmentRows: [string, string | number | null][] = []
  const postDeliveryRows: [string, string | number | null][] = [
    [t('details.commission'), `${formatCurrency(unit.commissionAmount, locale)} (${unit.commissionPercentage}%)`],
  ]
  if (!unit.maintenancePaid) {
    pricingRows.push(
      [t('details.maintenanceDueDate'), unit.maintenanceDueDate ?? t('common.notSet')],
    )
  }
  if (unit.paymentMethod === 'installment') {
    installmentRows.push([t('details.installmentType'), getInstallmentTypeLabel(unit.installmentType, t)])
    if (unit.installmentType === 'custom') {
      installmentRows.push([t('details.customInstallmentText'), customInstallmentText ?? t('common.notSet')])
    } else {
      if (hasInstallmentPeriod) {
        installmentRows.push(
          [t('details.installmentStartMonth'), formatMonthYear(locale, installmentStartMonth)],
          [t('details.installmentEndMonth'), formatMonthYear(locale, installmentEndMonth)],
        )
      } else {
        installmentRows.push([t('details.installmentYears'), unit.installmentYears ? formatCount(locale, unit.installmentYears) : t('common.notSet')])
      }
      installmentRows.push([t('details.installmentAmount'), formatCurrency(unit.installmentAmount, locale)])
    }
  }
  const ownerRows: [string, string | number | null][] = [
    [t('details.ownerName'), unit.originalOwnerName ?? t('common.notSet')],
    [t('details.ownerPhone'), unit.originalOwnerPhone ?? t('common.notSet')],
    [t('details.normalizedPhone'), unit.normalizedOwnerPhone ?? t('common.notSet')],
  ]
  return (
    <>
      <section className="content-card motion-stage details-overview-card" style={motionStyle(2, 70)}>
        <div className="section-heading details-compact-heading">
          <div>
            <p className="eyebrow">{t('details.unitCode')}</p>
            <h2>{t('details.mainInfo')}</h2>
          </div>
        </div>
        <div className="details-overview-grid">
          <InfoPanel title={t('details.mainInfo')} rows={mainInfoRows} />
          <InfoPanel title={t('details.pricing')} rows={pricingRows} />
        </div>
      </section>
      {unit.paymentMethod === 'installment' && installmentRows.length > 0 && (
        <section className="content-card motion-stage details-installment-summary-card" style={motionStyle(3, 100)}>
          <InfoPanel title={t('details.installmentDetails')} rows={installmentRows} />
        </section>
      )}
      <section className="content-card motion-stage details-installments-card" style={motionStyle(3, 100)}>
        <h2>{t('details.installmentsTable')}</h2>
        {unit.paymentMethod !== 'installment' && <EmptyState title={t('common.notSet')} body={t('payment.cash')} />}
        {unit.paymentMethod === 'installment' && unit.installmentType === 'custom' && <p className="media-empty-note" dir="auto">{customInstallmentText ?? t('details.customInstallmentMessage')}</p>}
        {unit.paymentMethod === 'installment' && unit.installmentType !== 'custom' && installmentSchedule.length > 0 && (
          <div className="installment-schedule" role="table" aria-label={t('details.installmentsTable')}>
            <div className="installment-summary" aria-live="polite">
              <span className="installment-summary-item">
                <span>{t('details.installmentsPaid')}</span>
                <strong>{formatCurrency(paidInstallmentTotal, locale)}</strong>
              </span>
              <span className="installment-summary-item">
                <span>{t('details.installmentsRemaining')}</span>
                <strong>{formatCurrency(timetableRemaining, locale)}</strong>
              </span>
            </div>
            {installmentSchedule.slice(0, 12).map((row) => (
              <div className="installment-row" role="row" key={row.paymentNumber}>
                <span className="installment-number" role="cell" aria-label={t('details.installmentNumber', { count: formatCount(locale, row.paymentNumber) })}>
                  {formatCount(locale, row.paymentNumber)}
                </span>
                <span className="installment-main" role="cell">
                  <span className="installment-period">{row.periodLabel}</span>
                  <span className="installment-amount-display">
                    <strong>{formatCurrency(row.amount, locale)}</strong>
                  </span>
                  {row.paidAt && <small>{formatDateTime(locale, row.paidAt)} / {row.paidByName ?? t('common.notSet')}</small>}
                </span>
                <span className="installment-controls" role="cell">
                  <span className={row.paid ? 'installment-status paid' : 'installment-status'}>{row.paid ? t('details.installmentPaid') : t('details.installmentUnpaid')}</span>
                </span>
              </div>
            ))}
            {installmentSchedule.length > 12 && <small>{t('details.scheduleTruncated', { count: formatCount(locale, installmentSchedule.length) })}</small>}
            {(unit.paymentHistory?.length ?? 0) > 0 && (
              <div className="payment-history-list" aria-label={t('details.paymentHistory')}>
                <strong>{t('details.paymentHistory')}</strong>
                {(unit.paymentHistory ?? []).slice(0, 5).map((history) => (
                  <small key={history.id}>
                    {t('details.paymentHistoryItem', {
                      actorName: history.actorName,
                      amount: formatCurrency(history.amount, locale),
                      action: history.action,
                      date: formatDateTime(locale, history.createdAt),
                      previous: formatCurrency(history.previousRemainingValue, locale),
                      next: formatCurrency(history.newRemainingValue, locale),
                    })}
                  </small>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      <section className="content-card motion-stage details-delivery-card" style={motionStyle(4, 130)}>
        <InfoPanel title={t('details.delivery')} rows={[[t('details.expectedDelivery'), formatDeliveryExpectancy(unit, locale)]]} />
      </section>
      <section className="content-card motion-stage details-post-delivery-card" style={motionStyle(5, 160)}>
        <InfoPanel title={t('details.commission')} rows={postDeliveryRows} />
      </section>
      <div className="details-secondary-grid">
        <section className="content-card motion-stage details-notes-card" style={motionStyle(6, 190)}>
          <h2>{t('details.notes')}</h2>
          <p dir="auto">{canViewSalesSensitiveData(user, unit) ? unit.salesNotes : t('details.salesSensitiveHidden')}</p>
          {unit.adminManagerNotes.map((note, index) => (
            <div className="note-card motion-stage" key={note.id} style={motionStyle(index, 210)}>
              <strong>{note.createdByName} / {getRoleLabel(locale, note.role)}</strong>
              <p dir="auto">{note.content}</p>
              <small>{formatDateTime(locale, note.createdAt)}</small>
            </div>
          ))}
          {(!canUseOperations || !canAddAdminManagerNote(user)) && <small>{t('details.salesCannotAddNotes')}</small>}
          {canUseOperations && canAddAdminManagerNote(user) && (
            <form
              className="note-editor"
              onSubmit={(event) => {
                event.preventDefault()
                onSaveNote(sharedNote)
              }}
            >
              <label className="wide-field">
                {t('details.editSharedNote')}
                <textarea value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} dir="auto" />
              </label>
              <div className="note-editor-actions">
                <button className="secondary-button" type="submit">{t('details.saveNote')}</button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    setSharedNote('')
                    onDeleteNote()
                  }}
                >
                  {t('details.deleteNote')}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <section className="content-card motion-stage details-gallery-card" style={motionStyle(7, 220)}>
        <h2>{t('details.mediaGallery')}</h2>
        {unit.media.length === 0 ? (
          <EmptyState title={t('details.noMediaTitle')} body={t('details.noMediaBody')} />
        ) : (
          <div className="media-grid">
            {unit.media.map((file, index) => (
              <div className="media-card motion-stage" key={file.id} style={motionStyle(index, 290)}>
                <div className="media-preview">
                  {file.type === 'image' ? (
                    <img src={file.url} alt={file.name} loading="lazy" decoding="async" />
                  ) : (
                    <div className={`media-file-placeholder ${file.type}`}>{file.type === 'pdf' ? 'PDF' : 'Blocked'}</div>
                  )}
                </div>
                <div className="media-card-body">
                  <div className="media-card-copy">
                    <strong dir="auto">{file.name}</strong>
                    <small>{file.type === 'image' ? t('details.mediaImage') : t('details.mediaFile')}</small>
                  </div>
                  <div className="media-card-actions">
                    {canRemoveMedia && file.type === 'image' && (
                      <button
                        className="pdf-visibility-toggle media-pdf-toggle"
                        type="button"
                        aria-pressed={file.includeInPdf !== false}
                        onClick={() => onMediaPdfVisibilityChange(file.id, file.includeInPdf === false)}
                      >
                        <span className="pdf-visibility-indicator" aria-hidden="true" />
                        <span>{file.includeInPdf !== false ? t('media.includeInPdf') : t('media.excludeFromPdf')}</span>
                      </button>
                    )}
                    <button
                      className="media-download-button secondary-button"
                      type="button"
                      aria-label={t('details.downloadMedia', { name: file.name })}
                      disabled={downloadingMediaId === file.id}
                      onClick={() => onMediaDownload(file)}
                    >
                      <Download size={17} /> {downloadingMediaId === file.id ? t('common.saving') : t('common.download')}
                    </button>
                    {canRemoveMedia && (
                      <button
                        className="media-remove-button danger-button"
                        type="button"
                        aria-label={t('details.removeMediaNamed', { name: file.name })}
                        disabled={removingMediaId === file.id}
                        onClick={() => onRemoveMedia(file.id)}
                      >
                        <Trash2 size={17} /> {removingMediaId === file.id ? t('common.saving') : t('details.removeMedia')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {ownerAllowed && (
        <section className="content-card motion-stage details-owner-card" style={motionStyle(8, 250)}>
          <InfoPanel title={t('details.ownerData')} rows={ownerRows} />
        </section>
      )}
    </>
  )
}


function DetailsLoadingSkeleton() {
  return (
    <div className="details-loading-skeleton" data-testid="details-loading-skeleton" aria-label="Loading unit details">
      <TextSkeleton lines={3} />
      <TextSkeleton lines={2} />
      <TextSkeleton lines={3} />
    </div>
  )
}
