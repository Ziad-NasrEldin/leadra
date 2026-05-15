import { Check, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { formatCount, useLocale } from '../lib/i18n'

export type BrandedSelectOption = {
  value: string
  label: string
}

export function BrandedSelect({
  labelId,
  name,
  options,
  value,
  defaultValue,
  disabled = false,
  onValueChange,
}: {
  labelId: string
  name?: string
  options: BrandedSelectOption[]
  value?: string
  defaultValue?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lastTypeaheadKey = useRef('')
  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const [highlightedValue, setHighlightedValue] = useState('')
  const [searchText, setSearchText] = useState('')
  const selectedValue = isControlled ? value ?? options[0]?.value ?? '' : internalValue
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0]
  const filteredOptions = searchText.trim()
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase()))
    : options
  const fallbackHighlightedValue = filteredOptions.some((option) => option.value === selectedValue)
    ? selectedValue
    : filteredOptions[0]?.value ?? ''
  const menuHighlightedValue = open ? highlightedValue || fallbackHighlightedValue : ''
  const highlightedOption = filteredOptions.find((option) => option.value === menuHighlightedValue)
  const highlightedIndex = highlightedOption ? filteredOptions.indexOf(highlightedOption) : -1
  const highlightedOptionId = open && highlightedIndex >= 0 ? `${menuId}-option-${highlightedIndex}` : undefined

  useEffect(() => {
    if (!open) return undefined
    const rootElement = document.documentElement

    function syncMenuPosition() {
      const root = rootRef.current
      if (!root) return

      const rect = root.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 12
      const estimatedHeight = Math.min(360, Math.max(116, filteredOptions.length * 50 + 76))
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding
      const maxHeight = Math.max(120, Math.min(estimatedHeight, availableBelow - gap))
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - rect.width - viewportPadding)
      const top = rect.bottom + gap

      setMenuStyle({
        position: 'fixed',
        top,
        bottom: 'auto',
        left,
        width: rect.width,
        maxHeight,
      })
    }

    function makeRoomForMenu() {
      const root = rootRef.current
      if (!root) return

      const rect = root.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 12
      const estimatedHeight = Math.min(360, Math.max(116, filteredOptions.length * 50 + 76))
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding
      const neededSpace = Math.max(0, estimatedHeight - availableBelow + gap)

      rootElement.style.setProperty('--brand-select-page-bottom-space', `${neededSpace + 24}px`)

      if (neededSpace > 0) {
        window.scrollBy({ top: neededSpace, behavior: 'auto' })
      }

      window.requestAnimationFrame(syncMenuPosition)
    }

    makeRoomForMenu()

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setHighlightedValue('')
        lastTypeaheadKey.current = ''
        setOpen(false)
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setHighlightedValue('')
        lastTypeaheadKey.current = ''
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointer)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', syncMenuPosition)
    window.addEventListener('scroll', syncMenuPosition, true)
    return () => {
      window.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', syncMenuPosition)
      window.removeEventListener('scroll', syncMenuPosition, true)
      rootElement.style.removeProperty('--brand-select-page-bottom-space')
    }
  }, [open, options.length, filteredOptions.length])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      if (typeof rootRef.current?.scrollIntoView === 'function') {
        rootRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      }
    })
  }, [open])

  useEffect(() => {
    if (!open || !highlightedValue) return
    window.requestAnimationFrame(() => {
      const highlightedElement = optionRefs.current[highlightedValue]
      if (typeof highlightedElement?.scrollIntoView === 'function') {
        highlightedElement.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    })
  }, [highlightedValue, open])

  function choose(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
    setHighlightedValue('')
    lastTypeaheadKey.current = ''
    setSearchText('')
    setOpen(false)
  }

  function handleTypeahead(key: string) {
    const normalizedKey = key.toLocaleLowerCase()
    const matches = filteredOptions
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => option.label.trim().toLocaleLowerCase().startsWith(normalizedKey))

    if (matches.length === 0) return

    const currentIndex = filteredOptions.findIndex((option) => option.value === (highlightedValue || selectedValue))
    const shouldCycle = lastTypeaheadKey.current === normalizedKey
    const nextMatch = shouldCycle ? matches.find((match) => match.index > currentIndex) ?? matches[0] : matches[0]

    lastTypeaheadKey.current = normalizedKey
    setHighlightedValue(nextMatch.option.value)
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        setHighlightedValue('')
        lastTypeaheadKey.current = ''
        setSearchText('')
        setOpen(false)
        return
      }

    if (event.key === 'Enter' && open) {
      event.preventDefault()
      choose(highlightedValue || selectedValue)
      return
    }

    if (!open || event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1 || event.key.trim() === '') {
      return
    }

    event.preventDefault()
    handleTypeahead(event.key)
  }

  return (
    <div className={`brand-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      {name && <input name={name} type="hidden" value={selectedOption?.value ?? ''} />}
      <button
        aria-activedescendant={highlightedOptionId}
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        className="brand-select-trigger"
        disabled={disabled}
        role="combobox"
        type="button"
        onClick={() => {
          setHighlightedValue('')
          lastTypeaheadKey.current = ''
          setSearchText('')
          setOpen((current) => !current)
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="brand-select-value">{selectedOption?.label ?? ''}</span>
        <ChevronDown size={18} />
      </button>
      {open &&
        createPortal(
          <div
            aria-labelledby={labelId}
            className="brand-select-menu brand-select-portal-menu"
            id={menuId}
            ref={menuRef}
            role="listbox"
            style={menuStyle}
          >
            <input
              aria-label="Search options"
              className="brand-select-search"
              placeholder="Search..."
              value={searchText}
              onChange={(event) => {
                const nextSearch = event.target.value
                setSearchText(nextSearch)
                const nextOption = options.find((option) =>
                  option.label.toLocaleLowerCase().includes(nextSearch.trim().toLocaleLowerCase()),
                )
                setHighlightedValue(nextOption?.value ?? '')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setSearchText('')
                  setHighlightedValue('')
                }
              }}
            />
            {filteredOptions.length === 0 && <div className="brand-select-empty">No matches</div>}
            {filteredOptions.map((option, index) => {
              const active = option.value === selectedValue
              const highlighted = option.value === menuHighlightedValue
              return (
                <button
                  key={option.value}
                  aria-selected={active}
                  className={`brand-select-option ${active ? 'is-active' : ''} ${highlighted ? 'is-highlighted' : ''}`}
                  id={`${menuId}-option-${index}`}
                  ref={(element) => {
                    optionRefs.current[option.value] = element
                  }}
                  role="option"
                  type="button"
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setHighlightedValue(option.value)}
                >
                  <span>{option.label}</span>
                  {active && <Check size={16} />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function RequiredLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <span className="required-label-text">
      {label}
      {required && <span className="required-marker" aria-hidden="true"> *</span>}
    </span>
  )
}

export function SelectField({ name, label, values, required = false }: { name: string; label: string; values: { id: string; label: string }[]; required?: boolean }) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect
        defaultValue={values[0]?.id}
        labelId={labelId}
        name={name}
        options={values.map((item) => ({ value: item.id, label: item.label }))}
      />
    </label>
  )
}

export function ControlledSelectField({
  label,
  options,
  value,
  disabled = false,
  className,
  required = false,
  onValueChange,
}: {
  label: string
  options: BrandedSelectOption[]
  value: string
  disabled?: boolean
  className?: string
  required?: boolean
  onValueChange: (value: string) => void
}) {
  const labelId = useId()
  return (
    <label className={className}>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect
        disabled={disabled}
        labelId={labelId}
        options={options}
        value={value}
        onValueChange={onValueChange}
      />
    </label>
  )
}

export function NamedSelectField({
  name,
  label,
  options,
  value,
  defaultValue,
  required = false,
  onValueChange,
}: {
  name: string
  label: string
  options: BrandedSelectOption[]
  value?: string
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string) => void
}) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect defaultValue={defaultValue} labelId={labelId} name={name} options={options} value={value} onValueChange={onValueChange} />
    </label>
  )
}

export function OwnerPhoneField({
  countryCode,
  countryOptions,
  hint,
  ownerPhone,
  placeholder,
  onCountryCodeChange,
  onOwnerPhoneChange,
}: {
  countryCode: string
  countryOptions: Array<BrandedSelectOption & { placeholder?: string }>
  hint: string
  ownerPhone: string
  placeholder: string
  onCountryCodeChange: (value: string) => void
  onOwnerPhoneChange: (value: string) => void
}) {
  const { t } = useLocale()
  const phoneLabelId = useId()
  const countryLabelId = useId()
  const hintId = useId()

  return (
    <div className="owner-phone-field">
      <span className="owner-phone-label" id={phoneLabelId}><RequiredLabel label={t('create.ownerPhone')} required /></span>
      <div className="owner-phone-shell" role="group" aria-labelledby={phoneLabelId}>
        <div className="owner-phone-country">
          <span className="sr-only" id={countryLabelId}>{t('create.countryCode')}</span>
          <BrandedSelect
            labelId={countryLabelId}
            name="countryCode"
            options={countryOptions}
            value={countryCode}
            onValueChange={onCountryCodeChange}
          />
        </div>
        <input
          aria-describedby={hintId}
          aria-labelledby={phoneLabelId}
          autoComplete="tel-national"
          dir="auto"
          inputMode="tel"
          name="ownerPhone"
          placeholder={placeholder}
          required
          value={ownerPhone}
          onChange={(event) => onOwnerPhoneChange(event.target.value)}
        />
      </div>
      <small className="sr-only" id={hintId}>{hint}</small>
    </div>
  )
}

export function NumberField({ name, label, defaultValue, min, max, required = false }: { name: string; label: string; defaultValue: number; min?: number; max?: number; required?: boolean }) {
  return (
    <label>
      <RequiredLabel label={label} required={required} />
      <input name={name} type="number" defaultValue={defaultValue} min={min} max={max} required={required} />
    </label>
  )
}

export function InfoSection({ title, rows, style }: { title: string; rows: [string, string | number | null][]; style?: CSSProperties }) {
  const { t } = useLocale()
  return (
    <section className="content-card motion-stage" style={style}>
      <h2>{title}</h2>
      <dl className="info-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{value ?? t('common.notSet')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function InfoPanel({ title, rows }: { title: string; rows: [string, string | number | null][] }) {
  const { t } = useLocale()
  return (
    <section className="details-info-panel">
      <h3>{title}</h3>
      <dl className="info-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{value ?? t('common.notSet')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Metric({ label, value, style }: { label: string; value: string | number; style?: CSSProperties }) {
  return (
    <div className="metric-card motion-stage" style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export function MiniBar({ label, value, total, suffix = '' }: { label: string; value: number; total: number; suffix?: string }) {
  const { locale } = useLocale()
  const width = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))

  return (
    <div className="mini-bar">
      <div>
        <span>{label}</span>
        <strong>{formatCount(locale, value)}{suffix}</strong>
      </div>
      <div className="mini-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function NavButton({
  active,
  label,
  onClick,
  to,
  icon,
  className = '',
  style,
}: {
  active: boolean
  label: string
  onClick?: () => void
  to?: string
  icon: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const classNameValue = `nav-button ${active ? 'active' : ''} ${className}`.trim()
  if (to) {
    return (
      <Link className={classNameValue} style={style} to={to} onClick={onClick}>
        {icon}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button className={classNameValue} type="button" style={style} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}


export function PasswordField({
  label,
  name,
  autoComplete,
  placeholder,
  required = false,
  minLength,
}: {
  label: string
  name: string
  autoComplete: string
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)

  return (
    <label>
      <RequiredLabel label={label} required={required} />
      <div className="password-input-wrap">
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          dir="auto"
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? t('login.hidePassword') : t('login.showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  )
}


export function NativeLookupSelect({
  name,
  label,
  values,
  defaultValue,
  required = false,
}: {
  name: string
  label: string
  values: { id: string; label: string }[]
  defaultValue: string
  required?: boolean
}) {
  const labelId = useId()
  return (
    <label>
      <span id={labelId}><RequiredLabel label={label} required={required} /></span>
      <BrandedSelect
        defaultValue={defaultValue}
        labelId={labelId}
        name={name}
        options={values.map((item) => ({ value: item.id, label: item.label }))}
      />
    </label>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string | number | null }) {
  const { t } = useLocale()
  return (
    <label>
      {label}
      <input readOnly disabled value={value ?? t('common.notSet')} />
    </label>
  )
}
