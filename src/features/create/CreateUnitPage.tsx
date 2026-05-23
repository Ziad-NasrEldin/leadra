import { useState, type FormEvent } from 'react'
import { getApplicableUnitAreaFields, getOwnerPhoneCountryMeta, getOwnerPhoneCountryOptions, PRD_FLOOR_OPTIONS, PRD_UNIT_TYPES, validateMediaUpload, formatCurrency } from '../../lib/domain'
import { formatCount, useLocale } from '../../lib/i18n'
import { renderError } from '../../lib/messageRendering'
import { formatInputNumber, parseFormattedNumber } from '../../lib/numberFormat'
import { parseSmartUnitDetails } from '../../lib/smartUnitParser'
import type { AppSettings, InstallmentType, LeadraMediaFile, LookupValue, MessageParams, PaymentMethod } from '../../lib/types'
import { ControlledSelectField, NamedSelectField, NumberField, OwnerPhoneField, RequiredLabel } from '../../components/LeadraUi'
import { createUnitSteps, type CreateUnitStep } from '../shared/constants'
import { countInstallmentsBetweenMonths } from '../shared/formUtils'
import { fileToMedia } from '../shared/media'
import { motionStyle } from '../shared/motion'
import { translateCreateStep } from '../shared/labels'

type UiMessage = { message: string; messageKey?: string | null; messageParams?: MessageParams | null }

type CreateUnitPageProps = {
  lookupValues: LookupValue[]
  activeStep: CreateUnitStep
  onStepChange: (step: CreateUnitStep) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) => void | Promise<void>
  settings: AppSettings
}

export function CreateUnitPage({
  lookupValues,
  activeStep,
  onStepChange,
  onSubmit,
  settings,
}: CreateUnitPageProps) {
  const { locale, t } = useLocale()
  const [selectedMedia, setSelectedMedia] = useState<LeadraMediaFile[]>([])
  const [mediaError, setMediaError] = useState<UiMessage | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('installment')
  const [cashAmount, setCashAmount] = useState(4_500_000)
  const [downPayment, setDownPayment] = useState(900_000)
  const [installmentAmount, setInstallmentAmount] = useState(225_000)
  const [installmentType, setInstallmentType] = useState<InstallmentType>('quarterly')
  const [installmentStartMonth, setInstallmentStartMonth] = useState('2026-03')
  const [installmentEndMonth, setInstallmentEndMonth] = useState('2030-03')
  const [installmentDueDay, setInstallmentDueDay] = useState(1)
  const [maintenancePaid, setMaintenancePaid] = useState(false)
  const [maintenanceCost, setMaintenanceCost] = useState(0)
  const [ownerCountryCode, setOwnerCountryCode] = useState('+20')
  const [ownerPhone, setOwnerPhone] = useState('01012345678')
  const [ownerName, setOwnerName] = useState('New Owner')
  const [salesNotes, setSalesNotes] = useState('Owner is responsive on WhatsApp.')
  const [smartDetails, setSmartDetails] = useState('')
  const [smartFeedback, setSmartFeedback] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [developerId, setDeveloperId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [viewId, setViewId] = useState('')
  const [finish, setFinish] = useState('')
  const [selectedUnitType, setSelectedUnitType] = useState('Apartment')
  const [selectedFloor, setSelectedFloor] = useState('2nd')
  const [bua, setBua] = useState(145)
  const [landArea, setLandArea] = useState(0)
  const [gardenArea, setGardenArea] = useState(0)
  const [terraceArea, setTerraceArea] = useState(0)
  const [bedrooms, setBedrooms] = useState(3)
  const [bathrooms, setBathrooms] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const activeStepIndex = createUnitSteps.indexOf(activeStep)
  const mediaValidation = validateMediaUpload(selectedMedia)
  const hasSelectedImage = selectedMedia.some((file) => file.type === 'image')
  const isCreateBlocked = submitting || !hasSelectedImage || !mediaValidation.ok
  const totalMediaMb = selectedMedia.reduce((total, file) => total + file.sizeBytes, 0) / (1024 * 1024)
  const installmentCount = countInstallmentsBetweenMonths(installmentType, installmentStartMonth, installmentEndMonth) ?? 0
  const usesCalculatedInstallmentTotal = paymentMethod === 'installment' && installmentType !== 'custom'
  const totalAmount = usesCalculatedInstallmentTotal ? downPayment + installmentAmount * installmentCount : cashAmount
  const remainingPayment = paymentMethod === 'installment' ? Math.max(0, totalAmount - downPayment) : 0
  const displayedRemainingPayment = paymentMethod === 'installment' ? remainingPayment + (maintenancePaid ? 0 : maintenanceCost) : maintenancePaid ? 0 : maintenanceCost

  const unitTypeOptions = PRD_UNIT_TYPES.map((unitType) => ({ value: unitType, label: unitType }))
  const lookupViewOptions = lookupValues
    .filter((item) => item.kind === 'view')
    .map((item) => ({ value: item.id, label: item.label }))
  const viewOptions = [
    { value: '', label: t('create.selectView') },
    ...lookupViewOptions,
  ]
  const finishOptions = [
    { value: '', label: t('create.selectFinish') },
    ...lookupValues
      .filter((item) => item.kind === 'finish')
      .map((item) => ({ value: item.label, label: item.label })),
  ]
  const floorOptions = PRD_FLOOR_OPTIONS.map((floor) => ({ value: floor, label: floor === 'Ground' ? t('create.ground') : floor }))
  const areaFields = getApplicableUnitAreaFields(selectedUnitType, selectedFloor)
  const deliveryYearOptions = Array.from({ length: 10 }, (_, index) => {
    const year = String(2026 + index)
    return { value: year, label: year }
  })
  const ownerPhoneCountryOptions = getOwnerPhoneCountryOptions(locale)
  const selectedOwnerPhoneCountry = getOwnerPhoneCountryMeta(ownerCountryCode, locale)

  function applySmartDetails() {
    const { patch, matched } = parseSmartUnitDetails(smartDetails, lookupValues)
    if (typeof patch.destinationId === 'string') setDestinationId(patch.destinationId)
    if (typeof patch.developerId === 'string') setDeveloperId(patch.developerId)
    if (typeof patch.projectId === 'string') setProjectId(patch.projectId)
    if (typeof patch.viewId === 'string') setViewId(patch.viewId)
    if (typeof patch.finish === 'string') setFinish(patch.finish)
    if (typeof patch.unitType === 'string') setSelectedUnitType(patch.unitType)
    if (typeof patch.floor === 'string') setSelectedFloor(patch.floor)
    if (typeof patch.bua === 'number') setBua(patch.bua)
    if (typeof patch.landArea === 'number') setLandArea(patch.landArea)
    if (typeof patch.gardenArea === 'number') setGardenArea(patch.gardenArea)
    if (typeof patch.terraceArea === 'number') setTerraceArea(patch.terraceArea)
    if (typeof patch.bedrooms === 'number') setBedrooms(patch.bedrooms)
    if (typeof patch.bathrooms === 'number') setBathrooms(patch.bathrooms)
    if (typeof patch.paymentMethod === 'string') setPaymentMethod(patch.paymentMethod as PaymentMethod)
    if (typeof patch.totalAmount === 'number') setCashAmount(patch.totalAmount)
    if (typeof patch.downPayment === 'number') setDownPayment(patch.downPayment)
    if (typeof patch.installmentType === 'string') setInstallmentType(patch.installmentType as InstallmentType)
    if (typeof patch.installmentStartMonth === 'string') setInstallmentStartMonth(patch.installmentStartMonth)
    if (typeof patch.installmentEndMonth === 'string') setInstallmentEndMonth(patch.installmentEndMonth)
    if (typeof patch.ownerName === 'string') setOwnerName(patch.ownerName)
    if (typeof patch.ownerPhone === 'string') setOwnerPhone(patch.ownerPhone)
    if (typeof patch.salesNotes === 'string') setSalesNotes(patch.salesNotes)
    setSmartFeedback(matched.length > 0 ? `Filled ${matched.length} field${matched.length === 1 ? '' : 's'}. Review before creating.` : 'No clear fields found. Add labels like project, price, BUA, owner phone.')
  }

  function goToRelativeStep(offset: number) {
    const nextIndex = Math.min(createUnitSteps.length - 1, Math.max(0, activeStepIndex + offset))
    onStepChange(createUnitSteps[nextIndex])
  }

  return (
    <section className="content-card create-card page-entrance create-page motion-stage motion-hero" style={motionStyle(0)}>
      <div className="section-heading motion-stage" style={motionStyle(0, 60)}>
        <div>
          <p className="eyebrow">{t('create.eyebrow')}</p>
          <h2>{t('create.heading')}</h2>
        </div>
      </div>
      <form
        className="wizard-shell"
        onSubmit={async (event) => {
          if (submitting) {
            event.preventDefault()
            return
          }
          if (!hasSelectedImage) {
            event.preventDefault()
            setMediaError({
              message: t('error.imageRequired'),
              messageKey: 'error.imageRequired',
            })
            return
          }
          const validation = validateMediaUpload(selectedMedia)
          if (!validation.ok) {
            event.preventDefault()
            setMediaError({
              message: validation.message ?? t('error.invalidMediaUpload'),
              messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
              messageParams: validation.messageParams ?? null,
            })
            return
          }

          setMediaError(null)
          setSubmitting(true)
          try {
            await onSubmit(event, selectedMedia)
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <CreateWizardSteps activeStep={activeStep} disabled={submitting} onStepChange={onStepChange} />

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Property'} aria-hidden={activeStep !== 'Property'}>
          <legend>{t('create.legend.property')}</legend>
          {activeStep === 'Property' && (
            <div className="smart-unit-panel">
              <label>
                Paste unit details
                <textarea value={smartDetails} onChange={(event) => setSmartDetails(event.target.value)} placeholder="Paste broker text, WhatsApp details, or listing copy" dir="auto" />
              </label>
              <button className="secondary-button" type="button" onClick={applySmartDetails} disabled={!smartDetails.trim()}>Auto-fill fields</button>
              {smartFeedback && <p className="media-empty-note" role="status">{smartFeedback}</p>}
            </div>
          )}
          <NamedSelectField name="destinationId" label={t('create.destination')} options={lookupValues.filter((item) => item.kind === 'destination').map((item) => ({ value: item.id, label: item.label }))} value={destinationId || (lookupValues.find((item) => item.kind === 'destination')?.id ?? '')} onValueChange={setDestinationId} required />
          <NamedSelectField name="developerId" label={t('create.developer')} options={lookupValues.filter((item) => item.kind === 'developer').map((item) => ({ value: item.id, label: item.label }))} value={developerId || (lookupValues.find((item) => item.kind === 'developer')?.id ?? '')} onValueChange={setDeveloperId} required />
          <NamedSelectField name="projectId" label={t('create.project')} options={lookupValues.filter((item) => item.kind === 'project').map((item) => ({ value: item.id, label: item.label }))} value={projectId || (lookupValues.find((item) => item.kind === 'project')?.id ?? '')} onValueChange={setProjectId} required />
          <NamedSelectField
            defaultValue="Apartment"
            label={t('create.unitType')}
            name="unitType"
            options={unitTypeOptions}
            required
            value={selectedUnitType}
            onValueChange={(value) => {
              setSelectedUnitType(value)
              if (!getApplicableUnitAreaFields(value, selectedFloor).showFloor) setSelectedFloor('Ground')
            }}
          />
          <NumberField key={`bua-${bua}`} name="bua" label={t('create.bua')} defaultValue={bua} min={1} required />
          {areaFields.showLandArea && <NumberField key={`land-${landArea}`} name="landArea" label={t('create.landArea')} defaultValue={landArea} min={0} required />}
          {areaFields.showFloor && (
            <NamedSelectField
              label={t('create.floor')}
              name="floor"
              options={floorOptions}
              required
              value={selectedFloor}
              onValueChange={setSelectedFloor}
            />
          )}
          {areaFields.showGardenArea && <NumberField key={`garden-${gardenArea}`} name="gardenArea" label={t('create.gardenArea')} defaultValue={gardenArea} min={0} />}
          {areaFields.showTerraceArea && <NumberField key={`terrace-${terraceArea}`} name="terraceArea" label={t('create.terraceArea')} defaultValue={terraceArea} min={0} required />}
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Specs'} aria-hidden={activeStep !== 'Specs'}>
          <legend>{t('create.legend.specs')}</legend>
          <NamedSelectField
            label={t('create.view')}
            name="viewId"
            options={viewOptions}
            value={viewId}
            onValueChange={setViewId}
            required
          />
          <NumberField key={`bedrooms-${bedrooms}`} name="bedrooms" label={t('create.bedrooms')} defaultValue={bedrooms} min={1} max={10} required />
          <NumberField key={`bathrooms-${bathrooms}`} name="bathrooms" label={t('create.bathrooms')} defaultValue={bathrooms} min={1} max={10} required />
          <label className="toggle-line"><input name="elevator" type="checkbox" defaultChecked /> {t('create.elevator')}</label>
          <NamedSelectField
            defaultValue="false"
            label={t('create.furnished')}
            name="furnished"
            options={[
              { value: 'true', label: t('create.furnishedOption') },
              { value: 'false', label: t('create.unfurnishedOption') },
            ]}
          />
          <NamedSelectField
            label={t('create.finish')}
            name="finish"
            required
            options={finishOptions}
            value={finish}
            onValueChange={setFinish}
          />
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Payment'} aria-hidden={activeStep !== 'Payment'}>
          <legend>{t('create.legend.payment')}</legend>
          <input name="paymentMethod" type="hidden" value={paymentMethod} />
          <ControlledSelectField
            label={t('create.paymentMethod')}
            options={[
              { value: 'cash', label: t('create.cash') },
              { value: 'installment', label: t('create.installment') },
            ]}
            value={paymentMethod}
            required
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
          <label>
            <RequiredLabel label={t('create.totalAmount')} required />
            {usesCalculatedInstallmentTotal
              ? <input name="totalAmount" role="spinbutton" readOnly required value={formatCurrency(totalAmount, locale)} />
              : <input name="totalAmount" type="text" role="spinbutton" inputMode="decimal" required value={formatInputNumber(cashAmount, locale)} onChange={(event) => setCashAmount(parseFormattedNumber(event.target.value))} />}
          </label>
          <label className="toggle-line">
            <input
              name="maintenancePaid"
              type="checkbox"
              checked={maintenancePaid}
              onChange={(event) => setMaintenancePaid(event.target.checked)}
            />{' '}
            {t('create.maintenancePaid')}
          </label>
          {!maintenancePaid && (
            <>
              <label>
                <RequiredLabel label={t('create.maintenanceCost')} required />
                <input name="maintenanceCost" type="text" role="spinbutton" inputMode="decimal" required value={formatInputNumber(maintenanceCost, locale)} onChange={(event) => setMaintenanceCost(parseFormattedNumber(event.target.value))} />
              </label>
              <label>
                {t('create.maintenanceDueDate')}
                <input name="maintenanceDueDate" type="date" />
              </label>
            </>
          )}
          {paymentMethod === 'installment' && (
            <>
              <label>
                <RequiredLabel label={t('create.downPayment')} required />
                <input name="downPayment" type="text" role="spinbutton" inputMode="decimal" required value={formatInputNumber(downPayment, locale)} onChange={(event) => setDownPayment(parseFormattedNumber(event.target.value))} />
              </label>
              <label>
                {t('details.remainingPayment')}
                <input readOnly value={formatCurrency(displayedRemainingPayment, locale)} />
              </label>
              <input name="installmentType" type="hidden" value={installmentType} />
              <ControlledSelectField
                label={t('details.installmentType')}
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
              {installmentType !== 'custom' ? (
                <>
                  <label>
                    <RequiredLabel label={t('create.installmentStartMonth')} required />
                    <input name="installmentStartMonth" type="month" required value={installmentStartMonth} onChange={(event) => setInstallmentStartMonth(event.target.value)} />
                  </label>
                  <label>
                    <RequiredLabel label={t('create.installmentEndMonth')} required />
                    <input name="installmentEndMonth" type="month" min={installmentStartMonth} required value={installmentEndMonth} onChange={(event) => setInstallmentEndMonth(event.target.value)} />
                  </label>
                  <label>
                    {t('details.installmentAmount')}
                    <input name="installmentAmountSeed" type="text" role="spinbutton" inputMode="decimal" required value={formatInputNumber(installmentAmount, locale)} onChange={(event) => setInstallmentAmount(parseFormattedNumber(event.target.value))} />
                  </label>
                  <label>
                    Installment due day
                    <input name="installmentDueDay" type="number" min={1} max={31} required value={installmentDueDay} onChange={(event) => setInstallmentDueDay(Number(event.target.value))} />
                  </label>
                </>
              ) : (
                <label className="wide-field">
                  <RequiredLabel label={t('create.customInstallmentText')} required />
                  <textarea name="customInstallmentText" required dir="auto" />
                </label>
              )}
            </>
          )}
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Owner'} aria-hidden={activeStep !== 'Owner'}>
          <legend>{t('create.legend.owner')}</legend>
          <label>
            <RequiredLabel label={t('create.ownerName')} required />
            <input name="ownerName" value={ownerName} required dir="auto" onChange={(event) => setOwnerName(event.target.value)} />
          </label>
          <OwnerPhoneField
            countryCode={ownerCountryCode}
            countryOptions={ownerPhoneCountryOptions}
            hint={t('create.ownerPhoneHint', { country: selectedOwnerPhoneCountry.label, example: selectedOwnerPhoneCountry.placeholder })}
            ownerPhone={ownerPhone}
            placeholder={selectedOwnerPhoneCountry.placeholder}
            onCountryCodeChange={setOwnerCountryCode}
            onOwnerPhoneChange={setOwnerPhone}
          />
          <NamedSelectField defaultValue="2028" label={t('create.deliveryDate')} name="deliveryYear" options={deliveryYearOptions} required />
          <label className="wide-field">
            {t('create.salesNotes')}
            <textarea name="salesNotes" value={salesNotes} dir="auto" onChange={(event) => setSalesNotes(event.target.value)} />
          </label>
        </fieldset>

        <section className="wizard-panel review-panel" data-active={activeStep === 'Review'} aria-hidden={activeStep !== 'Review'}>
          <p className="eyebrow">{t('create.reviewEyebrow')}</p>
          <h3>{t('create.reviewHeading')}</h3>
          <p>{t('create.reviewBody')}</p>
          <div className="media-upload-panel">
            <label>
              {t('create.unitImages')}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={async (event) => {
                  const files = Array.from(event.currentTarget.files ?? [])
                  const media = await Promise.all(files.map(fileToMedia))
                  const validation = validateMediaUpload(media)
                  setSelectedMedia(media)
                  setMediaError(
                    validation.ok
                      ? null
                      : {
                          message: validation.message ?? t('error.invalidMediaUpload'),
                          messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
                          messageParams: validation.messageParams ?? null,
                        },
                  )
                }}
              />
            </label>
            <div className="media-upload-summary motion-stage" style={motionStyle(0, 120)}>
              <strong>{t('create.imagesSelected', { count: formatCount(locale, selectedMedia.length) })}</strong>
              <span>{t('create.mediaUsage', { current: totalMediaMb.toFixed(2), limit: String(settings.mediaLimitMb) })}</span>
            </div>
            {mediaError && <p className="form-error motion-feedback">{renderError(locale, { message: mediaError.message, messageKey: mediaError.messageKey, messageParams: mediaError.messageParams })}</p>}
            {!mediaValidation.ok && !mediaError && <p className="form-error motion-feedback">{renderError(locale, { message: mediaValidation.message ?? t('error.invalidMediaUpload'), messageKey: mediaValidation.messageKey ?? 'error.invalidMediaUpload', messageParams: mediaValidation.messageParams ?? null })}</p>}
            {!hasSelectedImage && mediaValidation.ok && !mediaError && <p className="form-error motion-feedback">{t('error.imageRequired')}</p>}
            <div className="upload-preview-grid">
              {selectedMedia.map((file, index) => (
                <div className="upload-preview-card motion-stage" key={file.id} style={motionStyle(index, 170)}>
                  {file.type === 'image' ? (
                    <img src={file.url} alt={file.name} loading="lazy" decoding="async" />
                  ) : (
                    <div className={`media-file-placeholder ${file.type}`}>{file.type === 'pdf' ? 'PDF' : 'Blocked'}</div>
                  )}
                  <div>
                    <strong dir="auto">{file.name}</strong>
                    <small>{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
                  </div>
                  {file.type === 'image' && (
                    <label className="pdf-visibility-toggle">
                      <input
                        type="checkbox"
                        checked={file.includeInPdf !== false}
                        onChange={(event) => {
                          const includeInPdf = event.target.checked
                          setSelectedMedia((items) =>
                            items.map((item) => item.id === file.id ? { ...item, includeInPdf } : item),
                          )
                        }}
                      />
                      <span>{file.includeInPdf !== false ? t('media.includeInPdf') : t('media.excludeFromPdf')}</span>
                    </label>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      const nextMedia = selectedMedia.filter((item) => item.id !== file.id)
                      const validation = validateMediaUpload(nextMedia)
                      setSelectedMedia(nextMedia)
                      setMediaError(
                        validation.ok
                          ? null
                          : {
                              message: validation.message ?? t('error.invalidMediaUpload'),
                              messageKey: validation.messageKey ?? 'error.invalidMediaUpload',
                              messageParams: validation.messageParams ?? null,
                            },
                      )
                    }}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="primary-button" type="submit" disabled={isCreateBlocked}>
            {submitting ? t('common.saving') : t('create.createAndNotify')}
          </button>
        </section>

        <CreateWizardActions activeStep={activeStep} activeStepIndex={activeStepIndex} submitting={submitting} onStepOffset={goToRelativeStep} />
      </form>
    </section>
  )
}

function CreateWizardSteps({
  activeStep,
  disabled,
  onStepChange,
}: {
  activeStep: CreateUnitStep
  disabled: boolean
  onStepChange: (step: CreateUnitStep) => void
}) {
  const { locale, t } = useLocale()

  return (
    <div className="wizard-steps motion-stage" aria-label={t('create.steps')} style={motionStyle(1, 90)}>
      {createUnitSteps.map((step, index) => (
        <button
          key={step}
          className={`wizard-step ${step === activeStep ? 'active' : ''}`}
          type="button"
          aria-current={step === activeStep ? 'step' : undefined}
          disabled={disabled}
          onClick={() => onStepChange(step)}
        >
          <span>{formatCount(locale, index + 1)}</span>
          {translateCreateStep(step, locale)}
        </button>
      ))}
    </div>
  )
}

function CreateWizardActions({
  activeStep,
  activeStepIndex,
  submitting,
  onStepOffset,
}: {
  activeStep: CreateUnitStep
  activeStepIndex: number
  submitting: boolean
  onStepOffset: (offset: number) => void
}) {
  const { t } = useLocale()

  return (
    <div className="wizard-actions motion-stage" style={motionStyle(3, 140)}>
      <button className="secondary-button" type="button" disabled={submitting || activeStepIndex === 0} onClick={() => onStepOffset(-1)}>
        {t('common.back')}
      </button>
      {activeStep !== 'Review' && (
        <button className="primary-button" type="button" disabled={submitting} onClick={() => onStepOffset(1)}>
          {t('common.next')}
        </button>
      )}
    </div>
  )
}
