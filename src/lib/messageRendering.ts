import { translate, type LocaleCode, type MessageParams } from './i18n'
import type { AuditLogItem, NotificationItem } from './types'

export function renderNotificationTitle(locale: LocaleCode, notification: NotificationItem): string {
  if (notification.messageKey) {
    if (notification.messageKey.endsWith('.body')) {
      const titleKey = notification.messageKey.replace(/\.body$/, '.title')
      return translate(locale, titleKey, notification.messageParams ?? {})
    }
    return translate(locale, notification.messageKey, notification.messageParams ?? {})
  }

  return notification.title
}

export function renderNotificationBody(locale: LocaleCode, notification: NotificationItem): string {
  if (notification.messageKey) {
    return translate(locale, notification.messageKey, notification.messageParams ?? {})
  }

  return notification.body
}

export function renderAuditAction(locale: LocaleCode, audit: AuditLogItem): string {
  if (audit.messageKey) {
    return translate(locale, audit.messageKey, audit.messageParams ?? {})
  }

  return audit.actionType
}

export function renderFlash(locale: LocaleCode, flash: LocalizedFlashMessage): string {
  if (flash.messageKey) {
    return translate(locale, flash.messageKey, flash.messageParams ?? {})
  }

  return flash.text
}

export function renderError(
  locale: LocaleCode,
  input: { message?: string | null; messageKey?: string | null; messageParams?: MessageParams | null },
): string {
  if (input.messageKey) {
    return translate(locale, input.messageKey, input.messageParams ?? {})
  }

  return input.message ?? ''
}

export interface LocalizedFlashMessage {
  text: string
  messageKey?: string | null
  messageParams?: MessageParams | null
}
