import type { LeadraUser, UnitStatus } from './types'
import type { MessageParams } from './i18n'

export type LocalizedMessageKey =
  | 'message.notification.newAdminNote.title'
  | 'message.notification.newAdminNote.body'
  | 'message.notification.adminNoteUpdated.title'
  | 'message.notification.adminNoteUpdated.body'
  | 'message.notification.adminNoteDeleted.title'
  | 'message.notification.adminNoteDeleted.body'
  | 'message.notification.pdfExported.title'
  | 'message.notification.pdfExported.body'
  | 'message.notification.newUnitUploaded.title'
  | 'message.notification.newUnitUploaded.body'
  | 'message.notification.duplicatePhoneBlocked.title'
  | 'message.notification.duplicatePhoneBlocked.body'
  | 'message.notification.unitMarked.title'
  | 'message.notification.unitMarked.body'
  | 'message.notification.exportGenerated.title'
  | 'message.notification.exportGenerated.body'
  | 'message.audit.userCreated'
  | 'message.audit.unitCreated'
  | 'message.audit.duplicatePhoneBlocked'
  | 'message.audit.unitArchived'
  | 'message.audit.unitMarked'
  | 'message.audit.settingsUpdated'
  | 'message.audit.userProfileUpdated'
  | 'message.audit.userDeleted'
  | 'message.audit.salesRepDeactivatedAfterReassignment'
  | 'message.audit.exportGenerated'
  | 'message.audit.adminManagerNoteAdded'
  | 'message.audit.adminManagerNoteUpdated'
  | 'message.audit.adminManagerNoteDeleted'
  | 'flash.unitCreated'
  | 'flash.unitMarked'
  | 'flash.unitArchived'
  | 'flash.exportGenerated'
  | 'flash.userCreated'
  | 'flash.userUpdated'
  | 'flash.userDeleted'
  | 'flash.salesRepDeactivated'
  | 'flash.settingsUpdated'
  | 'flash.noteSaved'
  | 'flash.noteDeleted'
  | 'flash.unitMediaRemoved'
  | 'flash.unitUpdated'
  | 'error.invalidEmailOrPassword'
  | 'error.inactiveUsersCannotLogIn'
  | 'error.onlyAdminsCanCreateUsers'
  | 'error.userWithEmailExists'
  | 'error.invalidMediaUpload'
  | 'error.uploadLimitFiles'
  | 'error.uploadLimitSize'
  | 'error.duplicateOwnerPhoneBlocked'
  | 'error.invalidOwnerPhoneForCountry'
  | 'error.unitNotFound'
  | 'error.archiveNotAllowed'
  | 'error.unitOutsideVisibility'
  | 'error.onlyAdminsUpdateSettings'
  | 'error.unableToReadImage'
  | 'error.signInUnavailable'
  | 'error.inactiveProfile'
  | 'error.notePermissionDenied'
  | 'error.noteCannotBeEmpty'
  | 'error.noteMissing'
  | 'error.unitMediaRemoveNotAllowed'
  | 'error.unitMediaNotFound'

export interface LocalizedMessageRef {
  messageKey?: LocalizedMessageKey
  messageParams?: MessageParams | null
}

interface MessageDescriptor extends LocalizedMessageRef {
  text: string
}

interface NotificationDescriptor {
  title: MessageDescriptor
  body: MessageDescriptor
}

export function createErrorMessage(
  messageKey: LocalizedMessageKey,
  text: string,
  messageParams?: MessageParams,
) {
  return {
    error: text,
    errorKey: messageKey,
    errorParams: messageParams ?? null,
  }
}

export function createFlashMessage(messageKey: LocalizedMessageKey, text: string, messageParams?: MessageParams) {
  return {
    text,
    messageKey,
    messageParams: messageParams ?? null,
  }
}

export function createNotificationMessage(
  kind:
    | 'new_unit_uploaded'
    | 'duplicate_phone_blocked'
    | 'unit_marked'
    | 'export_generated'
    | 'new_admin_note'
    | 'admin_note_updated'
    | 'admin_note_deleted'
    | 'pdf_exported',
  params: MessageParams,
): NotificationDescriptor {
  switch (kind) {
    case 'new_unit_uploaded':
      return {
        title: { text: 'New unit uploaded', messageKey: 'message.notification.newUnitUploaded.title', messageParams: null },
        body: {
          text: `${String(params.actorName)} uploaded ${String(params.unitCode)}.`,
          messageKey: 'message.notification.newUnitUploaded.body',
          messageParams: params,
        },
      }
    case 'duplicate_phone_blocked':
      return {
        title: {
          text: 'Duplicate owner phone attempt',
          messageKey: 'message.notification.duplicatePhoneBlocked.title',
          messageParams: null,
        },
        body: {
          text: 'Same-project duplicate owner phone was blocked.',
          messageKey: 'message.notification.duplicatePhoneBlocked.body',
          messageParams: null,
        },
      }
    case 'unit_marked':
      return {
        title: {
          text: `Unit marked ${toTitleStatus(params.toStatus)}`,
          messageKey: 'message.notification.unitMarked.title',
          messageParams: { status: params.toStatus },
        },
        body: {
          text: `${String(params.unitCode)} changed from ${String(params.fromStatus)} to ${String(params.toStatus)}.`,
          messageKey: 'message.notification.unitMarked.body',
          messageParams: params,
        },
      }
    case 'new_admin_note':
      return {
        title: {
          text: 'New admin note',
          messageKey: 'message.notification.newAdminNote.title',
          messageParams: null,
        },
        body: {
          text: `${String(params.actorName)} commented on ${String(params.unitCode)}.`,
          messageKey: 'message.notification.newAdminNote.body',
          messageParams: params,
        },
      }
    case 'admin_note_updated':
      return {
        title: {
          text: 'Admin note updated',
          messageKey: 'message.notification.adminNoteUpdated.title',
          messageParams: null,
        },
        body: {
          text: `${String(params.actorName)} updated the shared note on ${String(params.unitCode)}.`,
          messageKey: 'message.notification.adminNoteUpdated.body',
          messageParams: params,
        },
      }
    case 'admin_note_deleted':
      return {
        title: {
          text: 'Admin note deleted',
          messageKey: 'message.notification.adminNoteDeleted.title',
          messageParams: null,
        },
        body: {
          text: `${String(params.actorName)} removed the shared note from ${String(params.unitCode)}.`,
          messageKey: 'message.notification.adminNoteDeleted.body',
          messageParams: params,
        },
      }
    case 'pdf_exported':
    case 'export_generated':
    default:
      return {
        title: { text: 'Export generated', messageKey: 'message.notification.exportGenerated.title', messageParams: null },
        body: {
          text: `Permission-safe printable brief generated (${String(params.unitCode)})`,
          messageKey: 'message.notification.exportGenerated.body',
          messageParams: params,
        },
      }
  }
}

export function createAuditMessage(
  kind:
    | 'user_created'
    | 'unit_created'
    | 'duplicate_phone_blocked'
    | 'unit_archived'
    | 'unit_marked'
    | 'settings_updated'
    | 'user_profile_updated'
    | 'user_deleted'
    | 'sales_rep_deactivated_after_reassignment'
    | 'export_generated'
    | 'admin_manager_note_added'
    | 'admin_manager_note_updated'
    | 'admin_manager_note_deleted',
  params: MessageParams = {},
): MessageDescriptor {
  switch (kind) {
    case 'user_created':
      return { text: 'User created', messageKey: 'message.audit.userCreated', messageParams: null }
    case 'unit_created':
      return { text: 'Unit created', messageKey: 'message.audit.unitCreated', messageParams: null }
    case 'duplicate_phone_blocked':
      return {
        text: 'Duplicate owner phone attempt inside same project',
        messageKey: 'message.audit.duplicatePhoneBlocked',
        messageParams: null,
      }
    case 'unit_archived':
      return { text: 'Unit archived', messageKey: 'message.audit.unitArchived', messageParams: null }
    case 'unit_marked':
      return {
        text: `Unit marked ${toTitleStatus(params.status)}`,
        messageKey: 'message.audit.unitMarked',
        messageParams: params,
      }
    case 'settings_updated':
      return { text: 'Settings updated', messageKey: 'message.audit.settingsUpdated', messageParams: null }
    case 'user_profile_updated':
      return { text: 'User profile updated', messageKey: 'message.audit.userProfileUpdated', messageParams: null }
    case 'user_deleted':
      return { text: 'User deactivated', messageKey: 'message.audit.userDeleted', messageParams: params }
    case 'sales_rep_deactivated_after_reassignment':
      return {
        text: 'Sales representative deactivated after reassignment',
        messageKey: 'message.audit.salesRepDeactivatedAfterReassignment',
        messageParams: params,
      }
    case 'admin_manager_note_added':
      return {
        text: 'Admin/manager note added',
        messageKey: 'message.audit.adminManagerNoteAdded',
        messageParams: null,
      }
    case 'admin_manager_note_updated':
      return {
        text: 'Admin/manager note updated',
        messageKey: 'message.audit.adminManagerNoteUpdated',
        messageParams: null,
      }
    case 'admin_manager_note_deleted':
      return {
        text: 'Admin/manager note deleted',
        messageKey: 'message.audit.adminManagerNoteDeleted',
        messageParams: null,
      }
    case 'export_generated':
    default:
      return { text: 'Export generated', messageKey: 'message.audit.exportGenerated', messageParams: null }
  }
}

export function createFlashForStatus(status: UnitStatus) {
  return createFlashMessage('flash.unitMarked', `Unit marked ${toTitleStatus(status)}.`, { status })
}

export function createNotificationAudience(actor: LeadraUser) {
  return {
    audienceRole: actor.role === 'sales' ? undefined : 'admin',
    userId: actor.role === 'sales' ? actor.id : undefined,
  }
}

function toTitleStatus(value: unknown): string {
  if (value === 'hold') return 'Hold'
  if (value === 'sold') return 'Sold'
  if (value === 'sold_by_us') return 'Sold by Us'
  if (value === 'sold_by_others') return 'Sold by Others'
  return 'Available'
}
