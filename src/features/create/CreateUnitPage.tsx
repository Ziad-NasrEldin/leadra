import { useState, type FormEvent } from 'react'
import { getApplicableUnitAreaFields, getOwnerPhoneCountryMeta, getOwnerPhoneCountryOptions, PRD_FLOOR_OPTIONS, PRD_UNIT_TYPES, validateMediaUpload, formatCurrency } from '../../lib/domain'
import { formatCount, useLocale } from '../../lib/i18n'
import { renderError } from '../../lib/messageRendering'
import type { AppSettings, InstallmentType, LeadraMediaFile, LookupValue, MessageParams, PaymentMethod } from '../../lib/types'
import { ControlledSelectField, NamedSelectField, NumberField, OwnerPhoneField, RequiredLabel, SelectField } from '../../components/LeadraUi'
import { createUnitSteps, type CreateUnitStep } from '../shared/constants'
import { calculateInstallmentAmountForPeriod, isAutomaticInstallmentType } from '../shared/formUtils'
import { fileToMedia } from '../shared/media'
import { motionStyle } from '../shared/motion'
import { translateCreateStep } from '../shared/labels'

type UiMessage = { message: string; messageKey?: string | null; messageParams?: MessageParams | null }

export function CreateUnitPage({
  lookupValues,
  activeStep,
  onStepChange,
  onSubmit,
  settings,
}: {
  lookupValues: LookupValue[]
  activeStep: CreateUnitStep
  onStepChange: (step: CreateUnitStep) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, uploadedMedia: LeadraMediaFile[]) => void | Promise<void>
  settings: AppSettings
}) {
  const { locale, t } = useLocale()
  const [selectedMedia, setSelectedMedia] = useState<LeadraMediaFile[]>([])
  const [mediaError, setMediaError] = useState<UiMessage | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('installment')
  const [totalAmount, setTotalAmount] = useState(4_500_000)
  const [downPayment, setDownPayment] = useState(900_000)
  const [installmentType, setInstallmentType] = useState<InstallmentType>('quarterly')
  const [installmentStartMonth, setInstallmentStartMonth] = useState('2026-03')
  const [installmentEndMonth, setInstallmentEndMonth] = useState('2030-03')
  const [maintenancePaid, setMaintenancePaid] = useState(false)
  const [maintenanceCost, setMaintenanceCost] = useState(0)
  const [ownerCountryCode, setOwnerCountryCode] = useState('+20')
  const [ownerPhone, setOwnerPhone] = useState('01012345678')
  const [selectedUnitType, setSelectedUnitType] = useState('Apartment')
  const [selectedFloor, setSelectedFloor] = useState('2nd')
  const [submitting, setSubmitting] = useState(false)
  const activeStepIndex = createUnitSteps.indexOf(activeStep)
  const mediaValidation = validateMediaUpload(selectedMedia)
  const hasSelectedImage = selectedMedia.some((file) => file.type === 'image')
  const isCreateBlocked = submitting || !hasSelectedImage || !mediaValidation.ok
  const totalMediaMb = selectedMedia.reduce((total, file) => total + file.sizeBytes, 0) / (1024 * 1024)
  const remainingPayment = Math.max(0, totalAmount - downPayment)
  const displayedPaidAmount = paymentMethod === 'installment' ? downPayment : totalAmount
  const displayedRemainingPayment = paymentMethod === 'installment' ? remainingPayment + (maintenancePaid ? 0 : maintenanceCost) : maintenancePaid ? 0 : maintenanceCost
  const calculatedInstallment =
    paymentMethod === 'installment' && isAutomaticInstallmentType(installmentType)
      ? calculateInstallmentAmountForPeriod(remainingPayment, installmentType, installmentStartMonth, installmentEndMonth)
      : null

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
        <div className="wizard-steps motion-stage" aria-label={t('create.steps')} style={motionStyle(1, 90)}>
          {createUnitSteps.map((step, index) => (
            <button
              key={step}
              className={`wizard-step ${step === activeStep ? 'active' : ''}`}
              type="button"
              aria-current={step === activeStep ? 'step' : undefined}
              disabled={submitting}
              onClick={() => onStepChange(step)}
            >
              <span>{formatCount(locale, index + 1)}</span>
              {translateCreateStep(step, locale)}
            </button>
          ))}
        </div>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Property'} aria-hidden={activeStep !== 'Property'}>
          <legend>{t('create.legend.property')}</legend>
          <SelectField name="destinationId" label={t('create.destination')} values={lookupValues.filter((item) => item.kind === 'destination')} required />
          <SelectField name="developerId" label={t('create.developer')} values={lookupValues.filter((item) => item.kind === 'developer')} required />
          <SelectField name="projectId" label={t('create.project')} values={lookupValues.filter((item) => item.kind === 'project')} required />
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
          <NumberField name="bua" label={t('create.bua')} defaultValue={145} min={1} required />
          {areaFields.showLandArea && <NumberField name="landArea" label={t('create.landArea')} defaultValue={0} min={0} required />}
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
          {areaFields.showGardenArea && <NumberField name="gardenArea" label={t('create.gardenArea')} defaultValue={0} min={0} />}
          {areaFields.showTerraceArea && <NumberField name="terraceArea" label={t('create.terraceArea')} defaultValue={0} min={0} required />}
        </fieldset>

        <fieldset className="unit-form wizard-panel" data-active={activeStep === 'Specs'} aria-hidden={activeStep !== 'Specs'}>
          <legend>{t('create.legend.specs')}</legend>
          <NamedSelectField
            label={t('create.view')}
            name="viewId"
            options={viewOptions}
            required
          />
          <NumberField name="bedrooms" label={t('create.bedrooms')} defaultValue={3} min={1} max={10} required />
          <NumberField name="bathrooms" label={t('create.bathrooms')} defaultValue={2} min={1} max={10} required />
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
            <input name="totalAmount" type="number" min={0} required value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
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
                <input name="maintenanceCost" type="number" min={0} step="0.01" required value={maintenanceCost} onChange={(event) => setMaintenanceCost(Number(event.target.value))} />
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
                <input name="downPayment" type="number" min={0} max={totalAmount} required value={downPayment} onChange={(event) => setDownPayment(Number(event.target.value))} />
              </label>
              <label>
                {t('details.remainingPayment')}
                <input readOnly value={formatCurrency(displayedRemainingPayment, locale)} />
              </label>
              <label>
                {t('details.paidAmount')}
                <input readOnly value={formatCurrency(displayedPaidAmount, locale)} />
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
                    <input readOnly value={formatCurrency(calculatedInstallment, locale)} />
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
            <input name="ownerName" defaultValue="New Owner" required dir="auto" />
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
            <textarea name="salesNotes" defaultValue="Owner is responsive on WhatsApp." dir="auto" />
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

        <div className="wizard-actions motion-stage" style={motionStyle(3, 140)}>
          <button className="secondary-button" type="button" disabled={submitting || activeStepIndex === 0} onClick={() => goToRelativeStep(-1)}>
            {t('common.back')}
          </button>
          {activeStep !== 'Review' && (
            <button className="primary-button" type="button" disabled={submitting} onClick={() => goToRelativeStep(1)}>
              {t('common.next')}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
