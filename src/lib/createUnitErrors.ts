import type { LocalizedFlashMessage } from './messageRendering'

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Please try again.'
}

function errorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) return String(error.code)
  return ''
}

function errorText(error: unknown) {
  return `${errorCode(error)} ${errorMessage(error)}`.toLowerCase()
}

function isSchemaCacheError(error: unknown) {
  const text = errorText(error)
  return text.includes('schema cache') || text.includes('include_in_pdf') || text.includes('pgrst204')
}

function isDuplicateOwnerPhoneError(error: unknown) {
  const text = errorText(error)
  return text.includes('23505') || text.includes('units_project_owner_phone_unique')
}

function isPermissionError(error: unknown) {
  const text = errorText(error)
  return text.includes('42501') || text.includes('permission denied') || text.includes('row-level security')
}

function isNetworkError(error: unknown) {
  const text = errorText(error)
  return text.includes('failed to fetch') || text.includes('networkerror') || text.includes('load failed')
}

export function createUnitRemoteErrorFlash(error: unknown): LocalizedFlashMessage {
  if (isSchemaCacheError(error)) {
    return {
      text: 'Unit could not be created because the database is missing the media PDF visibility column or its schema cache is stale. Run the latest Supabase migrations, then reload the PostgREST schema cache.',
      messageKey: null,
      messageParams: null,
    }
  }
  if (isDuplicateOwnerPhoneError(error)) {
    return {
      text: 'Unit could not be created because this owner phone already exists for the selected project.',
      messageKey: null,
      messageParams: null,
    }
  }
  if (isPermissionError(error)) {
    return {
      text: 'Unit could not be created because your account does not have permission to save this unit or its media.',
      messageKey: null,
      messageParams: null,
    }
  }
  if (isNetworkError(error)) {
    return {
      text: 'Unit could not be created because the network connection failed. Check your connection and try again.',
      messageKey: null,
      messageParams: null,
    }
  }
  return {
    text: `Unit could not be created. ${errorMessage(error)}`,
    messageKey: null,
    messageParams: null,
  }
}

export function mediaPdfVisibilityErrorFlash(error: unknown): LocalizedFlashMessage {
  if (isSchemaCacheError(error)) {
    return {
      text: 'PDF visibility could not be saved because the database is missing the media PDF visibility column or its schema cache is stale. Run the latest Supabase migrations, then reload the PostgREST schema cache.',
      messageKey: null,
      messageParams: null,
    }
  }
  if (isPermissionError(error)) {
    return { text: 'PDF visibility could not be saved because your account does not have permission to update this media.', messageKey: null, messageParams: null }
  }
  if (isNetworkError(error)) {
    return { text: 'PDF visibility could not be saved because the network connection failed. Please try again.', messageKey: null, messageParams: null }
  }
  return { text: 'PDF visibility could not be saved remotely. Please try again.', messageKey: null, messageParams: null }
}
