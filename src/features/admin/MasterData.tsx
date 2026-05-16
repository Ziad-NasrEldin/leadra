import { Building2, Image as ImageIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { compareText, formatCount, useLocale } from '../../lib/i18n'
import type { BranchDirectoryItem, LookupKind, LookupValue, TeamDirectoryItem } from '../../lib/types'
import { EmptyState } from '../../components/LeadraUi'
import { lookupKindOptions, supportsLookupThumbnail, type LookupThumbnailChange, type MasterDataDirectory } from '../shared/constants'
import { getLookupKindLabel } from '../shared/labels'
import { useLookupThumbnailSources } from '../shared/media'
import { motionStyle } from '../shared/motion'

export function MasterDataPanel({
  lookupValues,
  branches,
  teams,
  activeDirectory,
  onDirectoryChange,
  userCounts,
  onCreateLookupValue,
  onUpdateLookupValue,
  onArchiveLookupValue,
  onCreateBranch,
  onUpdateBranch,
  onArchiveBranch,
  onCreateTeam,
  onUpdateTeam,
  onArchiveTeam,
}: {
  lookupValues: LookupValue[]
  branches: BranchDirectoryItem[]
  teams: TeamDirectoryItem[]
  activeDirectory: MasterDataDirectory
  onDirectoryChange: (directory: MasterDataDirectory) => void
  userCounts: Record<string, number>
  onCreateLookupValue: (kind: LookupKind, label: string, thumbnailFile?: File | null) => Promise<void>
  onUpdateLookupValue: (lookupId: string, label: string, thumbnailChange?: LookupThumbnailChange) => Promise<void>
  onArchiveLookupValue: (lookupId: string) => Promise<void>
  onCreateBranch: (name: string) => Promise<void>
  onUpdateBranch: (branchId: string, name: string) => Promise<void>
  onArchiveBranch: (branchId: string) => Promise<void>
  onCreateTeam: (name: string) => Promise<void>
  onUpdateTeam: (teamId: string, name: string) => Promise<void>
  onArchiveTeam: (teamId: string) => Promise<void>
}) {
  const { locale, t } = useLocale()
  const [directoryQuery, setDirectoryQuery] = useState('')
  const thumbnailSources = useLookupThumbnailSources(lookupValues)
  const directoryOptions = [
    ...lookupKindOptions.map((kind) => ({
      id: kind,
      label: getLookupKindLabel(kind, locale),
      count: lookupValues.filter((value) => value.kind === kind && !value.archived).length,
    })),
    { id: 'branches' as const, label: t('admin.branchManagement'), count: branches.length },
    { id: 'teams' as const, label: t('admin.teamManagement'), count: teams.length },
  ]
  const activeOption = directoryOptions.find((option) => option.id === activeDirectory) ?? directoryOptions[0]
  const query = directoryQuery.trim().toLowerCase()
  const activeItems =
    activeDirectory === 'branches'
      ? branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          meta: t('admin.branch'),
          locked: teams.some((team) => team.branchId === branch.id),
        }))
      : activeDirectory === 'teams'
        ? teams.map((team) => ({
            id: team.id,
            name: team.name,
            meta: t('admin.teamMemberCount', { count: formatCount(locale, userCounts[team.id] ?? 0) }),
            locked: (userCounts[team.id] ?? 0) > 0,
          }))
        : lookupValues
            .filter((value) => value.kind === activeDirectory && !value.archived)
            .map((value) => ({
              id: value.id,
              name: value.label,
              meta: getLookupKindLabel(value.kind, locale),
              thumbnailPath: value.thumbnailPath,
              thumbnailSrc: thumbnailSources[value.id] ?? null,
              supportsThumbnail: supportsLookupThumbnail(value.kind),
              locked: false,
            }))
  const visibleItems = activeItems
    .filter((item) => query.length === 0 || item.name.toLowerCase().includes(query) || item.meta.toLowerCase().includes(query))
    .sort((first, second) => compareText(locale, first.name, second.name))
  const createConfig =
    activeDirectory === 'branches'
      ? {
          label: t('admin.branchName'),
          name: 'branchName',
          placeholder: t('admin.branchNamePlaceholder'),
          buttonLabel: t('admin.addBranch'),
          onCreate: onCreateBranch,
        }
      : activeDirectory === 'teams'
        ? {
            label: t('admin.teamName'),
            name: 'teamName',
            placeholder: t('admin.teamNamePlaceholder'),
            buttonLabel: t('admin.addTeam'),
            onCreate: onCreateTeam,
          }
        : {
            label: t('admin.lookupLabel'),
            name: 'lookupLabel',
            placeholder: t('admin.lookupLabelPlaceholder'),
            buttonLabel: t('admin.addLookupValue'),
            onCreate: (label: string, thumbnailFile?: File | null) => onCreateLookupValue(activeDirectory, label, thumbnailFile),
          }
  const updateDirectoryItem =
    activeDirectory === 'branches'
      ? onUpdateBranch
      : activeDirectory === 'teams'
        ? onUpdateTeam
        : onUpdateLookupValue
  const archiveDirectoryItem =
    activeDirectory === 'branches'
      ? onArchiveBranch
      : activeDirectory === 'teams'
        ? onArchiveTeam
        : onArchiveLookupValue

  return (
    <section className="content-card admin-panel motion-stage motion-subtle" style={motionStyle(1)}>
      <div className="admin-user-header">
        <div>
          <p className="eyebrow">{t('admin.masterDataEyebrow')}</p>
          <h2><Building2 size={19} /> {t('admin.masterData')}</h2>
          <p>{t('admin.masterDataCopy')}</p>
        </div>
      </div>

      <div className="master-data-workspace">
        <nav className="master-data-rail" aria-label={t('admin.masterData')}>
          {directoryOptions.map((option) => (
            <button
              key={option.id}
              className={`master-data-tab ${option.id === activeDirectory ? 'active' : ''}`}
              type="button"
              aria-current={option.id === activeDirectory ? 'page' : undefined}
              onClick={() => {
                onDirectoryChange(option.id)
                setDirectoryQuery('')
              }}
            >
              <span>{option.label}</span>
              <strong>{formatCount(locale, option.count)}</strong>
            </button>
          ))}
        </nav>

        <div className="master-data-detail">
          <div className="master-data-toolbar">
            <div>
              <p className="eyebrow">{t('admin.selectedDirectory')}</p>
              <h3>{activeOption.label}</h3>
            </div>
            <label className="master-data-search">
              {t('admin.searchMasterData')}
              <input
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                placeholder={t('admin.searchMasterDataPlaceholder')}
                dir="auto"
              />
            </label>
          </div>

          <DirectoryCreateForm {...createConfig} supportsThumbnail={supportsLookupThumbnail(activeDirectory)} />
          <DirectoryList
            title={activeOption.label}
            emptyTitle={t('admin.noLookupValuesTitle')}
            emptyBody={t('admin.noLookupValuesBody')}
            items={visibleItems}
            onUpdate={updateDirectoryItem}
            onArchive={archiveDirectoryItem}
          />
        </div>
      </div>
    </section>
  )
}

function DirectoryCreateForm({
  label,
  name,
  placeholder,
  buttonLabel,
  extraControl,
  supportsThumbnail = false,
  onCreate,
}: {
  label: string
  name: string
  placeholder: string
  buttonLabel: string
  extraControl?: ReactNode
  supportsThumbnail?: boolean
  onCreate: (value: string, thumbnailFile?: File | null) => Promise<void>
}) {
  const { t } = useLocale()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!thumbnailFile) {
      const timeout = window.setTimeout(() => {
        if (!cancelled) setThumbnailPreview(null)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
    }

    const preview = URL.createObjectURL(thumbnailFile)
    const timeout = window.setTimeout(() => {
      if (!cancelled) setThumbnailPreview(preview)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      URL.revokeObjectURL(preview)
    }
  }, [thumbnailFile])

  return (
    <form
      className="settings-form create-user-panel"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const value = String(new FormData(form).get(name) ?? '').trim()
        setError('')
        if (!value) {
          setError(t('admin.valueRequired'))
          return
        }
        try {
          setPending(true)
          await onCreate(value, supportsThumbnail ? thumbnailFile : null)
          form.reset()
          setThumbnailFile(null)
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : t('admin.valueSaveFailed'))
        } finally {
          setPending(false)
        }
      }}
    >
      {extraControl}
      <label>
        {label}
        <input name={name} required placeholder={placeholder} dir="auto" />
      </label>
      {supportsThumbnail && (
        <LookupThumbnailPicker
          label={t('admin.lookupThumbnailImage')}
          helpText={t('admin.lookupThumbnailHelp')}
          file={thumbnailFile}
          previewSrc={thumbnailPreview}
          onFileChange={setThumbnailFile}
          onRemove={() => setThumbnailFile(null)}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? t('common.saving') : buttonLabel}</button>
    </form>
  )
}

function LookupThumbnailPicker({
  label,
  helpText,
  file,
  previewSrc,
  existingName,
  onFileChange,
  onRemove,
}: {
  label: string
  helpText: string
  file: File | null
  previewSrc: string | null
  existingName?: string
  onFileChange: (file: File | null) => void
  onRemove: () => void
}) {
  const { t } = useLocale()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const displayName = file?.name ?? existingName
  const displaySize = file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : null
  const hasThumbnail = Boolean(file || previewSrc || existingName)

  return (
    <div className="lookup-thumbnail-field">
      <label className="lookup-thumbnail-label" htmlFor={inputId}>{label}</label>
      <div className="lookup-thumbnail-control">
        <div className="directory-thumbnail-preview large">
          {previewSrc ? <img src={previewSrc} alt="" loading="lazy" /> : <ImageIcon size={20} />}
        </div>
        <div className="lookup-thumbnail-copy">
          <small>{helpText}</small>
          {displayName && <strong dir="auto">{displayName}</strong>}
          {displaySize && <small>{displaySize}</small>}
          <div className="lookup-thumbnail-actions">
            <button className="secondary-button compact-action" type="button" onClick={() => inputRef.current?.click()}>
              {hasThumbnail ? t('admin.lookupThumbnailReplace') : t('admin.lookupThumbnailImage')}
            </button>
            {hasThumbnail && (
              <button className="ghost-button compact-action" type="button" onClick={onRemove}>
                {t('admin.lookupThumbnailRemove')}
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label={label}
        accept="image/*"
        onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)}
      />
    </div>
  )
}

function DirectoryList({
  title,
  emptyTitle,
  emptyBody,
  items,
  onUpdate,
  onArchive,
}: {
  title: string
  emptyTitle: string
  emptyBody: string
  items: Array<{ id: string; name: string; meta: string; locked: boolean; thumbnailPath?: string | null; thumbnailSrc?: string | null; supportsThumbnail?: boolean }>
  onUpdate: (id: string, name: string, thumbnailChange?: LookupThumbnailChange) => Promise<void>
  onArchive: (id: string) => Promise<void>
}) {
  const { t } = useLocale()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="user-management-list" aria-label={title}>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <DirectoryCard
          key={item.id}
          item={item}
          index={index}
          isEditing={editingId === item.id}
          onEdit={() => setEditingId(item.id)}
          onCancel={() => setEditingId(null)}
          onSave={async (name, thumbnailChange) => {
            await onUpdate(item.id, name, thumbnailChange)
            setEditingId(null)
          }}
          onArchive={() => onArchive(item.id)}
        />
      ))}
      {items.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} />}
      {items.some((item) => item.locked) && <small>{t('admin.archiveLockedHint')}</small>}
    </div>
  )
}

function DirectoryCard({
  item,
  index,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onArchive,
}: {
  item: { id: string; name: string; meta: string; locked: boolean; thumbnailPath?: string | null; thumbnailSrc?: string | null; supportsThumbnail?: boolean }
  index: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (name: string, thumbnailChange?: LookupThumbnailChange) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const { t } = useLocale()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [removeThumbnail, setRemoveThumbnail] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!thumbnailFile) {
      const timeout = window.setTimeout(() => {
        if (!cancelled) setThumbnailPreview(null)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
    }

    const preview = URL.createObjectURL(thumbnailFile)
    const timeout = window.setTimeout(() => {
      if (!cancelled) setThumbnailPreview(preview)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      URL.revokeObjectURL(preview)
    }
  }, [thumbnailFile])

  useEffect(() => {
    if (isEditing) return undefined
    const timeout = window.setTimeout(() => {
      setThumbnailFile(null)
      setRemoveThumbnail(false)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [isEditing])

  return (
    <article
      className={`user-management-card directory-card${item.supportsThumbnail ? ' directory-card--media' : ''} motion-stage active`}
      style={motionStyle(index)}
    >
      <div className="user-management-main">
        {item.supportsThumbnail && (
          <div className="directory-thumbnail-preview">
            {item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" loading="lazy" /> : <ImageIcon size={18} />}
          </div>
        )}
        <div className="directory-card-copy">
          <strong dir="auto">{item.name}</strong>
          <span>{item.meta}</span>
        </div>
      </div>
      {!isEditing && (
        <div className="user-card-actions">
          <button className="secondary-button" type="button" onClick={onEdit} disabled={pending}>{t('common.edit')}</button>
          <button className="danger-button" type="button" onClick={async () => {
            setPending(true)
            try {
              await onArchive()
            } finally {
              setPending(false)
            }
          }} disabled={pending || item.locked}>{pending ? t('common.saving') : t('common.archive')}</button>
        </div>
      )}
      {isEditing && (
        <form
          className={`user-edit-form directory-edit-form${item.supportsThumbnail ? ' directory-edit-form--media' : ''} motion-stage`}
          style={motionStyle(0, 80)}
          onSubmit={async (event) => {
            event.preventDefault()
            const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
            setError('')
            if (!name) {
              setError(t('admin.valueRequired'))
              return
            }
            try {
              setPending(true)
              await onSave(name, item.supportsThumbnail ? { file: thumbnailFile, remove: removeThumbnail } : undefined)
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : t('admin.valueSaveFailed'))
            } finally {
              setPending(false)
            }
          }}
        >
          <label>
            {t('admin.valueName')}
            <input name="name" required defaultValue={item.name} dir="auto" />
          </label>
          {item.supportsThumbnail && (
            <LookupThumbnailPicker
              label={t('admin.lookupThumbnailImage')}
              helpText={t('admin.lookupThumbnailHelp')}
              file={thumbnailFile}
              previewSrc={removeThumbnail ? null : thumbnailPreview ?? item.thumbnailSrc ?? null}
              existingName={item.thumbnailPath ? item.thumbnailPath.split('/').pop() : undefined}
              onFileChange={(file) => {
                setThumbnailFile(file)
                setRemoveThumbnail(false)
              }}
              onRemove={() => {
                setThumbnailFile(null)
                setRemoveThumbnail(true)
              }}
            />
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="user-edit-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={pending}>{t('common.cancel')}</button>
            <button className="secondary-button" type="submit" disabled={pending}>{pending ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      )}
    </article>
  )
}
