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
  | 'message.notification.pdfGenerated.title'
  | 'message.notification.pdfGenerated.body'
  | 'message.notification.pdfDownloaded.title'
  | 'message.notification.pdfDownloaded.body'
  | 'message.notification.pdfShared.title'
  | 'message.notification.pdfShared.body'
  | 'message.notification.newUnitUploaded.title'
  | 'message.notification.newUnitUploaded.body'
  | 'message.notification.duplicatePhoneBlocked.title'
  | 'message.notification.duplicatePhoneBlocked.body'
  | 'message.notification.unitMarked.title'
  | 'message.notification.unitMarked.body'
  | 'message.notification.unitPricingUpdated.title'
  | 'message.notification.unitPricingUpdated.body'
  | 'message.notification.paymentTimetableRemainingRecalculated.title'
  | 'message.notification.paymentTimetableRemainingRecalculated.body'
  | 'message.notification.salesReassigned.title'
  | 'message.notification.salesReassigned.body'
  | 'message.notification.passwordReset.title'
  | 'message.notification.passwordReset.body'
  | 'message.notification.passwordUpdated.title'
  | 'message.notification.passwordUpdated.body'
  | 'message.notification.mediaShownInPdf.title'
  | 'message.notification.mediaShownInPdf.body'
  | 'message.notification.mediaHiddenFromPdf.title'
  | 'message.notification.mediaHiddenFromPdf.body'
  | 'message.notification.mediaDownloaded.title'
  | 'message.notification.mediaDownloaded.body'
  | 'message.notification.mediaRemoved.title'
  | 'message.notification.mediaRemoved.body'
  | 'message.notification.videoRejected.title'
  | 'message.notification.videoRejected.body'
  | 'message.notification.pdfAttachmentPhotoRequired.title'
  | 'message.notification.pdfAttachmentPhotoRequired.body'
  | 'message.notification.salesInactivity72h.title'
  | 'message.notification.salesInactivity72h.body'
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
  | 'message.audit.pdfGenerated'
  | 'message.audit.pdfExported'
  | 'message.audit.pdfDownloaded'
  | 'message.audit.pdfShared'
  | 'message.audit.unitPricingUpdated'
  | 'message.audit.paymentTimetableRemainingRecalculated'
  | 'message.audit.salesReassigned'
  | 'message.audit.passwordReset'
  | 'message.audit.passwordUpdated'
  | 'message.audit.mediaShownInPdf'
  | 'message.audit.mediaHiddenFromPdf'
  | 'message.audit.mediaDownloaded'
  | 'message.audit.mediaRemoved'
  | 'message.audit.videoRejected'
  | 'message.audit.pdfAttachmentPhotoRequired'
  | 'message.audit.salesInactivity72h'
  | 'message.audit.adminManagerNoteAdded'
  | 'message.audit.adminManagerNoteUpdated'
  | 'message.audit.adminManagerNoteDeleted'
  | 'flash.unitCreated'
  | 'flash.unitMarked'
  | 'flash.unitSpecialMarked'
  | 'flash.unitSpecialRemoved'
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
  | 'flash.unitMediaShownInPdf'
  | 'flash.unitMediaHiddenFromPdf'
  | 'flash.unitMediaDownloaded'
  | 'flash.unitUpdated'
  | 'flash.unitPricingUpdated'
  | 'flash.paymentTimetableRemainingRecalculated'
  | 'flash.passwordUpdated'
  | 'error.invalidEmailOrPassword'
  | 'error.inactiveUsersCannotLogIn'
  | 'error.onlyAdminsCanCreateUsers'
  | 'error.userWithEmailExists'
  | 'error.invalidMediaUpload'
  | 'error.uploadLimitFiles'
  | 'error.uploadLimitSize'
  | 'error.duplicateOwnerPhoneBlocked'
  | 'error.viewRequired'
  | 'error.finishRequired'
  | 'error.invalidOwnerPhoneForCountry'
  | 'error.unitNotFound'
  | 'error.archiveNotAllowed'
  | 'error.specialNotAllowed'
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
  | 'error.videoRejected'
  | 'error.pdfAttachmentPhotoRequired'

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
    | 'pdf_generated'
    | 'pdf_downloaded'
    | 'pdf_shared'
    | 'unit_pricing_updated'
    | 'payment_timetable_remaining_recalculated'
    | 'sales_reassigned'
    | 'password_reset'
    | 'password_updated'
    | 'media_shown_in_pdf'
    | 'media_hidden_from_pdf'
    | 'media_downloaded'
    | 'media_removed'
    | 'video_rejected'
    | 'pdf_attachment_photo_required'
    | 'sales_inactivity_72h'
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
          text: `${String(params.unitCode)} changed from ${toTitleStatus(params.fromStatus)} to ${toTitleStatus(params.toStatus)}.`,
          messageKey: 'message.notification.unitMarked.body',
          messageParams: params,
        },
      }
    case 'pdf_generated':
      return {
        title: { text: 'PDF generated', messageKey: 'message.notification.pdfGenerated.title', messageParams: null },
        body: {
          text: `PDF generated for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.pdfGenerated.body',
          messageParams: params,
        },
      }
    case 'pdf_downloaded':
      return {
        title: { text: 'PDF downloaded', messageKey: 'message.notification.pdfDownloaded.title', messageParams: null },
        body: {
          text: `PDF downloaded for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.pdfDownloaded.body',
          messageParams: params,
        },
      }
    case 'pdf_shared':
      return {
        title: { text: 'PDF shared', messageKey: 'message.notification.pdfShared.title', messageParams: null },
        body: {
          text: `PDF shared for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.pdfShared.body',
          messageParams: params,
        },
      }
    case 'sales_inactivity_72h':
      return {
        title: {
          text: '72-hour upload warning',
          messageKey: 'message.notification.salesInactivity72h.title',
          messageParams: null,
        },
        body: {
          text: `${String(params.userName)} has not uploaded a unit in the last 72 hours.`,
          messageKey: 'message.notification.salesInactivity72h.body',
          messageParams: params,
        },
      }
    case 'unit_pricing_updated':
      return {
        title: {
          text: 'Unit pricing updated',
          messageKey: 'message.notification.unitPricingUpdated.title',
          messageParams: null,
        },
        body: {
          text: `Pricing was updated for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.unitPricingUpdated.body',
          messageParams: params,
        },
      }
    case 'payment_timetable_remaining_recalculated':
      return {
        title: {
          text: 'Payment timetable remaining recalculated',
          messageKey: 'message.notification.paymentTimetableRemainingRecalculated.title',
          messageParams: null,
        },
        body: {
          text: `Remaining payment was recalculated for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.paymentTimetableRemainingRecalculated.body',
          messageParams: params,
        },
      }
    case 'sales_reassigned':
      return {
        title: { text: 'Sales reassignment completed', messageKey: 'message.notification.salesReassigned.title', messageParams: null },
        body: {
          text: `${String(params.unitCode)} reassigned from ${String(params.fromSalesName)} to ${String(params.toSalesName)}.`,
          messageKey: 'message.notification.salesReassigned.body',
          messageParams: params,
        },
      }
    case 'password_reset':
      return {
        title: { text: 'Password reset', messageKey: 'message.notification.passwordReset.title', messageParams: null },
        body: {
          text: `Password reset for ${String(params.userName)}.`,
          messageKey: 'message.notification.passwordReset.body',
          messageParams: params,
        },
      }
    case 'password_updated':
      return {
        title: { text: 'Password updated', messageKey: 'message.notification.passwordUpdated.title', messageParams: null },
        body: {
          text: `Password updated for ${String(params.userName)}.`,
          messageKey: 'message.notification.passwordUpdated.body',
          messageParams: params,
        },
      }
    case 'media_shown_in_pdf':
      return {
        title: { text: 'Media shown in PDF', messageKey: 'message.notification.mediaShownInPdf.title', messageParams: null },
        body: {
          text: `${String(params.mediaName)} will show in the PDF for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.mediaShownInPdf.body',
          messageParams: params,
        },
      }
    case 'media_hidden_from_pdf':
      return {
        title: { text: 'Media hidden from PDF', messageKey: 'message.notification.mediaHiddenFromPdf.title', messageParams: null },
        body: {
          text: `${String(params.mediaName)} will be hidden from the PDF for ${String(params.unitCode)}.`,
          messageKey: 'message.notification.mediaHiddenFromPdf.body',
          messageParams: params,
        },
      }
    case 'media_downloaded':
      return {
        title: { text: 'Media downloaded', messageKey: 'message.notification.mediaDownloaded.title', messageParams: null },
        body: {
          text: `${String(params.mediaName)} downloaded from ${String(params.unitCode)}.`,
          messageKey: 'message.notification.mediaDownloaded.body',
          messageParams: params,
        },
      }
    case 'media_removed':
      return {
        title: { text: 'Media removed', messageKey: 'message.notification.mediaRemoved.title', messageParams: null },
        body: {
          text: `${String(params.mediaName)} removed from ${String(params.unitCode)}.`,
          messageKey: 'message.notification.mediaRemoved.body',
          messageParams: params,
        },
      }
    case 'video_rejected':
      return {
        title: { text: 'Video rejected', messageKey: 'message.notification.videoRejected.title', messageParams: null },
        body: {
          text: 'Only photo attachments are accepted for unit PDFs.',
          messageKey: 'message.notification.videoRejected.body',
          messageParams: params,
        },
      }
    case 'pdf_attachment_photo_required':
      return {
        title: {
          text: 'Photo attachment required',
          messageKey: 'message.notification.pdfAttachmentPhotoRequired.title',
          messageParams: null,
        },
        body: {
          text: 'Attach at least one photo before generating the unit PDF.',
          messageKey: 'message.notification.pdfAttachmentPhotoRequired.body',
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
    | 'pdf_generated'
    | 'pdf_exported'
    | 'pdf_downloaded'
    | 'pdf_shared'
    | 'unit_pricing_updated'
    | 'payment_timetable_remaining_recalculated'
    | 'sales_reassigned'
    | 'password_reset'
    | 'password_updated'
    | 'media_shown_in_pdf'
    | 'media_hidden_from_pdf'
    | 'media_downloaded'
    | 'media_removed'
    | 'video_rejected'
    | 'pdf_attachment_photo_required'
    | 'sales_inactivity_72h'
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
    case 'pdf_generated':
      return { text: 'PDF generated', messageKey: 'message.audit.pdfGenerated', messageParams: params }
    case 'pdf_exported':
      return { text: 'PDF exported', messageKey: 'message.audit.pdfExported', messageParams: params }
    case 'pdf_downloaded':
      return { text: 'PDF downloaded', messageKey: 'message.audit.pdfDownloaded', messageParams: params }
    case 'pdf_shared':
      return { text: 'PDF shared', messageKey: 'message.audit.pdfShared', messageParams: params }
    case 'unit_pricing_updated':
      return { text: 'Unit pricing updated', messageKey: 'message.audit.unitPricingUpdated', messageParams: params }
    case 'payment_timetable_remaining_recalculated':
      return {
        text: 'Payment timetable remaining recalculated',
        messageKey: 'message.audit.paymentTimetableRemainingRecalculated',
        messageParams: params,
      }
    case 'sales_reassigned':
      return { text: 'Sales reassignment completed', messageKey: 'message.audit.salesReassigned', messageParams: params }
    case 'password_reset':
      return { text: 'Password reset', messageKey: 'message.audit.passwordReset', messageParams: params }
    case 'password_updated':
      return { text: 'Password updated', messageKey: 'message.audit.passwordUpdated', messageParams: params }
    case 'media_shown_in_pdf':
      return { text: 'Media shown in PDF', messageKey: 'message.audit.mediaShownInPdf', messageParams: params }
    case 'media_hidden_from_pdf':
      return { text: 'Media hidden from PDF', messageKey: 'message.audit.mediaHiddenFromPdf', messageParams: params }
    case 'media_downloaded':
      return { text: 'Media downloaded', messageKey: 'message.audit.mediaDownloaded', messageParams: params }
    case 'media_removed':
      return { text: 'Media removed', messageKey: 'message.audit.mediaRemoved', messageParams: params }
    case 'video_rejected':
      return { text: 'Video rejected', messageKey: 'message.audit.videoRejected', messageParams: params }
    case 'pdf_attachment_photo_required':
      return {
        text: 'PDF attachment photo required',
        messageKey: 'message.audit.pdfAttachmentPhotoRequired',
        messageParams: params,
      }
    case 'sales_inactivity_72h':
      return {
        text: '72-hour inactivity warning queued',
        messageKey: 'message.audit.salesInactivity72h',
        messageParams: params,
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
