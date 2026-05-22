import type { GeneratedPdf } from './pdf'
import { createAuditMessage, createNotificationMessage } from './systemMessages'
import type { AnalyticsEventType, AuditLogItem, LeadraUnit, LeadraUser, NotificationItem } from './types'

export type GeneratedPdfCache = Record<number, GeneratedPdf>
export type PdfActionKind = 'pdf_generated' | 'pdf_downloaded' | 'pdf_shared'

const pdfAdminAudience = ['admin', 'sub_admin'] as const

export function pdfAnalyticsEventType(kind: PdfActionKind): AnalyticsEventType {
  return kind === 'pdf_generated' ? 'pdf_generated' : 'pdf_shared_or_downloaded'
}

export function buildPdfActionRecords(
  user: LeadraUser,
  unit: LeadraUnit,
  kind: PdfActionKind,
  createdAt = new Date().toISOString(),
): {
  auditMessage: ReturnType<typeof createAuditMessage>
  notificationMessage: ReturnType<typeof createNotificationMessage>
  notifications: NotificationItem[]
  auditLog: AuditLogItem
  adminAudience: Array<(typeof pdfAdminAudience)[number]>
} {
  const notificationMessage = createNotificationMessage(kind, { unitCode: unit.unitCode })
  const auditMessage = createAuditMessage(kind, { unitCode: unit.unitCode })
  return {
    auditMessage,
    notificationMessage,
    notifications: pdfAdminAudience.map((role) => ({
      id: `notif-${kind}-${role}-${unit.id}-${createdAt}`,
      title: notificationMessage.title.text,
      body: notificationMessage.body.text,
      messageKey: notificationMessage.body.messageKey ?? null,
      messageParams: notificationMessage.body.messageParams ?? null,
      audienceRole: role,
      createdAt,
      read: false,
    })),
    auditLog: {
      id: `audit-${kind}-${unit.id}-${createdAt}`,
      actorName: user.fullName,
      actorRole: user.role,
      actionType: auditMessage.text,
      messageKey: auditMessage.messageKey ?? null,
      messageParams: auditMessage.messageParams ?? null,
      relatedUnitCode: unit.unitCode,
      createdAt,
      ipAddress: null,
    },
    adminAudience: [...pdfAdminAudience],
  }
}

export async function getOrGenerateUnitPdf(
  unit: LeadraUnit,
  generatedPdfs: GeneratedPdfCache,
  generatePdfFile: (unit: LeadraUnit) => Promise<GeneratedPdf>,
): Promise<GeneratedPdf> {
  return generatedPdfs[unit.id] ?? await generatePdfFile(unit)
}

export async function getOrGenerateUnitPdfs(
  units: LeadraUnit[],
  generatedPdfs: GeneratedPdfCache,
  generatePdfFile: (unit: LeadraUnit) => Promise<GeneratedPdf>,
): Promise<GeneratedPdf[]> {
  const pdfs: GeneratedPdf[] = []
  for (const unit of units) {
    pdfs.push(await getOrGenerateUnitPdf(unit, generatedPdfs, generatePdfFile))
  }
  return pdfs
}
