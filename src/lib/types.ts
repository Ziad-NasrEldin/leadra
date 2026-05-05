export type UserRole = 'admin' | 'sub_admin' | 'manager' | 'sales'
export type AccountStatus = 'active' | 'inactive'
export type UnitStatus = 'available' | 'hold' | 'sold'
export type PaymentMethod = 'cash' | 'installment'
export type InstallmentType = 'quarterly' | 'semi_annual' | 'annual' | 'custom'
export type MediaType = 'image' | 'video'
export type LookupKind = 'developer' | 'project' | 'destination' | 'view' | 'unit_type' | 'finish'
export type AnalyticsEventType =
  | 'unit_created'
  | 'unit_updated'
  | 'status_changed'
  | 'unit_archived'
  | 'media_uploaded'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  | 'pdf_generated'
  | 'pdf_shared_or_downloaded'
  | 'duplicate_phone_blocked'
  | 'price_updated'
  | 'payment_updated'
  | 'installment_updated'
  | 'user_login'
  | 'inactive_user_detected'
  | 'settings_updated'
export type AnalyticsTargetScope = 'company' | 'team' | 'user'
export type AnalyticsTargetPeriod = 'monthly' | 'quarterly'
export type MessageParams = Record<string, string | number | boolean | null | undefined>

export interface LeadraUser {
  id: string
  fullName: string
  email: string
  role: UserRole
  jobTitle: string
  phoneNumber: string
  teamId: string
  branchId: string
  status: AccountStatus
  createdAt?: string
  lastLoginAt?: string | null
}

export interface LookupValue {
  id: string
  kind: LookupKind
  label: string
  archived?: boolean
}

export interface LeadraMediaFile {
  id: string
  type: MediaType
  url: string
  name: string
  sizeBytes: number
}

export interface LeadraNote {
  id: string
  content: string
  createdBy: string
  createdByName: string
  role: UserRole
  createdAt: string
}

export interface DeliveryExpectancy {
  mode: 'year' | 'month_year'
  month?: number
  year: number
}

export interface LeadraUnit {
  id: number
  unitCode: string
  developerId: string
  developerName: string
  projectId: string
  projectName: string
  destinationId: string
  destinationName: string
  unitType: string
  floor: string
  bua: number
  roofGardenArea: number | null
  viewId: string
  viewName: string
  bedrooms: number
  bathrooms: number
  elevator: boolean
  landArea: number | null
  furnished: boolean
  finish: string
  paymentMethod: PaymentMethod
  totalAmount: number
  downPayment: number | null
  remainingPayment: number | null
  commissionPercentage: number
  commissionAmount: number
  installmentType: InstallmentType | null
  installmentYears: number | null
  installmentAmount: number | null
  deliveryExpectancy: DeliveryExpectancy
  originalOwnerName: string | null
  countryCode: string | null
  originalOwnerPhone: string | null
  normalizedOwnerPhone: string | null
  salesNotes: string
  status: UnitStatus
  archived: boolean
  createdBy: string
  createdByName: string
  teamId: string
  branchId: string
  createdAt: string
  updatedAt: string
  media: LeadraMediaFile[]
  adminManagerNotes: LeadraNote[]
}

export interface PaymentInput {
  paymentMethod: PaymentMethod
  totalAmount: number
  downPayment?: number | null
  commissionPercentage?: number
  installmentType?: InstallmentType | null
  installmentYears?: number | null
}

export interface PaymentSummary {
  remainingPayment: number | null
  commissionAmount: number
  installmentAmount: number | null
}

export interface MediaValidation {
  ok: boolean
  message?: string
  messageKey?: string | null
  messageParams?: MessageParams | null
}

export interface UnitFilters {
  projectId?: string
  unitCode?: string
  status?: UnitStatus | 'all'
  developerId?: string
  destinationId?: string
  unitType?: string
  bedrooms?: number | 'all'
  bathrooms?: number | 'all'
  paymentMethod?: PaymentMethod | 'all'
  ownerPhone?: string
  buaFrom?: number
  buaTo?: number
  priceFrom?: number
  priceTo?: number
  cashPriceFrom?: number
  cashPriceTo?: number
  downPaymentFrom?: number
  downPaymentTo?: number
  remainingPaymentFrom?: number
  remainingPaymentTo?: number
  installmentType?: InstallmentType | 'all'
  installmentAmountFrom?: number
  installmentAmountTo?: number
  deliveryYear?: number | 'all'
  deliveryMonth?: number | 'all'
}

export interface DestinationSummary {
  destinationId: string
  destinationName: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
}

export interface ProjectSummary {
  projectId: string
  projectName: string
  destinationId?: string
  destinationName?: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  messageKey?: string | null
  messageParams?: MessageParams | null
  audienceRole?: UserRole
  userId?: string
  createdAt: string
  read: boolean
}

export interface AuditLogItem {
  id: string
  actorName: string
  actorRole: UserRole
  actionType: string
  messageKey?: string | null
  messageParams?: MessageParams | null
  relatedUnitCode?: string
  previousValue?: string | null
  newValue?: string | null
  ipAddress?: string | null
  createdAt: string
}

export interface AnalyticsEvent {
  id: string
  eventType: AnalyticsEventType
  actorId: string
  actorRole: UserRole
  teamId: string | null
  branchId: string | null
  unitId?: number | null
  projectId?: string | null
  developerId?: string | null
  destinationId?: string | null
  unitStatusBefore?: UnitStatus | null
  unitStatusAfter?: UnitStatus | null
  amountValue?: number | null
  commissionValue?: number | null
  metadata: Record<string, string | number | boolean | null>
  createdAt: string
}

export interface AnalyticsTarget {
  id: string
  scopeType: AnalyticsTargetScope
  scopeId: string | null
  period: AnalyticsTargetPeriod
  targetUnitsCreated: number
  targetUnitsSold: number
  targetSoldValue: number
  targetCommission: number
  targetActivityEvents: number
  startsAt: string
  endsAt: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AnalyticsOverviewSummary {
  totalActiveUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
  soldValue: number
  projectedCommission: number
  activeUsers: number
  duplicateAttempts: number
  pdfExports: number
  inactiveUsers: number
  archivedUnits: number
  staleUnits: number
}

export interface AnalyticsSalesPerformance {
  userId: string
  userName: string
  role: UserRole
  teamId: string
  unitsCreated: number
  unitsSold: number
  soldValue: number
  commissionContribution: number
  activityCount: number
  lastActivityAt: string | null
}

export interface AnalyticsInventoryHealth {
  projectId: string
  projectName: string
  developerName: string
  destinationName: string
  totalUnits: number
  availableUnits: number
  holdUnits: number
  soldUnits: number
  holdRatio: number
  averagePrice: number
  mediaCompleteness: number
  staleUnits: number
}

export interface AnalyticsTimelinePoint {
  date: string
  unitsCreated: number
  statusChanges: number
  soldValue: number
  pdfExports: number
  activityCount: number
}

export interface AnalyticsTargetProgress {
  targetId: string
  label: string
  unitsCreatedProgress: number
  unitsSoldProgress: number
  soldValueProgress: number
  commissionProgress: number
  activityProgress: number
}

export type AnalyticsDateWindow = 'live' | '30d' | '90d' | 'custom'

export interface AnalyticsFilters {
  dateWindow: AnalyticsDateWindow
  startDate?: string
  endDate?: string
  teamIds: string[]
  userIds: string[]
  projectIds: string[]
  developerIds: string[]
  destinationIds: string[]
  statuses: UnitStatus[]
  paymentMethods: PaymentMethod[]
}

export interface AnalyticsFilterOption {
  id: string
  label: string
}

export interface AnalyticsFilterOptions {
  teams: AnalyticsFilterOption[]
  users: AnalyticsFilterOption[]
  projects: AnalyticsFilterOption[]
  developers: AnalyticsFilterOption[]
  destinations: AnalyticsFilterOption[]
}

export interface AnalyticsChartPoint {
  date: string
  label: string
  value: number
}

export interface AnalyticsDashboard {
  scopeLabel: string
  overview: AnalyticsOverviewSummary
  salesPerformance: AnalyticsSalesPerformance[]
  inventoryHealth: AnalyticsInventoryHealth[]
  activityTimeline: AnalyticsTimelinePoint[]
  soldValueTrend: AnalyticsChartPoint[]
  pdfExportTrend: AnalyticsChartPoint[]
  targetProgress: AnalyticsTargetProgress[]
  filterOptions: AnalyticsFilterOptions
}

export interface AppSettings {
  companyName: string
  commissionPercentage: number
  footerText: string
  contactDetails: string
  mediaLimitMb: number
  paymentMethods: PaymentMethod[]
}

export interface AppDataState {
  users: LeadraUser[]
  units: LeadraUnit[]
  notifications: NotificationItem[]
  auditLogs: AuditLogItem[]
  analyticsEvents: AnalyticsEvent[]
  analyticsTargets: AnalyticsTarget[]
  settings: AppSettings
}

export interface CreateUserInput {
  fullName: string
  email: string
  role: UserRole
  jobTitle: string
  phoneNumber: string
  teamId: string
  branchId: string
  status: AccountStatus
}

export interface CreateUnitInput {
  developerId: string
  developerName: string
  projectId: string
  projectName: string
  destinationId: string
  destinationName: string
  unitType: string
  floor: string
  bua: number
  roofGardenArea?: number | null
  viewId: string
  viewName: string
  bedrooms: number
  bathrooms: number
  elevator: boolean
  landArea?: number | null
  furnished: boolean
  finish: string
  paymentMethod: PaymentMethod
  totalAmount: number
  downPayment?: number | null
  installmentType?: InstallmentType | null
  installmentYears?: number | null
  deliveryExpectancy: DeliveryExpectancy
  originalOwnerName: string
  countryCode: string
  originalOwnerPhone: string
  salesNotes: string
  media: LeadraMediaFile[]
}

export type WorkflowResult<T = AppDataState> =
  | { ok: true; state: T; error?: never; errorKey?: never; errorParams?: never }
  | { ok: false; state: T; error: string; errorKey?: string | null; errorParams?: MessageParams | null }
