import { describe, expect, it } from 'vitest'
import {
  calculatePaymentSummary,
  calculateDisplayedPaymentTotals,
  calculateInstallmentTotalAmount,
  canArchiveUnit,
  canEditAnyUnitDetails,
  canEditNonOwnerUnitDetails,
  canEditOwnerFields,
  canEditUnitCommission,
  canEditUnitPricing,
  canManageUnitSpecialStatus,
  canUseUnitOperationalActions,
  canSearchOwnerPhone,
  canViewSalesSensitiveData,
  canViewUnit,
  canViewOwnerData,
  filterUnitsForUser,
  generateUnitCode,
  getInstallmentScheduledDueMonths,
  applyPaymentScheduleAction,
  buildPaymentTimetable,
  createInitialPaymentSchedule,
  searchUnits,
  summarizeDestinations,
  summarizeProjects,
  buildInstallmentSchedule,
  deriveProjectAbbreviation,
  formatDeliveryExpectancy,
  getApplicableUnitAreaFields,
  getOwnerPhoneCountryMeta,
  getOwnerPhoneCountryOptions,
  getThumbnailMedia,
  normalizeReactiveUnitFilters,
  normalizeOwnerPhone,
  PRD_FLOOR_OPTIONS,
  PRD_UNIT_TYPES,
  sanitizeUnitForPdf,
  unitHasSameProjectPhoneDuplicate,
  validateOwnerPhoneForCountry,
  validateMediaUpload,
} from './domain'
import { countActiveUnitFilters } from '../features/shared/formUtils'
import { parseFormattedNumber } from './numberFormat'
import { parseSmartUnitDetails } from './smartUnitParser'
import { buildSpecialUnitSocialCopy } from './unitCopy'
import type { LeadraMediaFile, LeadraUnit, LeadraUser } from './types'

const admin: LeadraUser = {
  id: 'admin-1',
  fullName: 'Nour Admin',
  email: 'admin@leadra.test',
  role: 'admin',
  jobTitle: 'Admin',
  phoneNumber: '+201000000000',
  teamId: 'team-a',
  branchId: 'branch-cairo',
  status: 'active',
}

const subAdmin: LeadraUser = {
  ...admin,
  id: 'subadmin-1',
  fullName: 'Laila Sub Admin',
  email: 'subadmin@leadra.test',
  role: 'sub_admin',
}

const manager: LeadraUser = {
  ...admin,
  id: 'manager-1',
  fullName: 'Mona Manager',
  email: 'manager@leadra.test',
  role: 'manager',
  teamId: 'team-a',
}

const salesA: LeadraUser = {
  ...admin,
  id: 'sales-a',
  fullName: 'Sara Sales',
  email: 'sales@leadra.test',
  role: 'sales',
  teamId: 'team-a',
}

const salesB: LeadraUser = {
  ...salesA,
  id: 'sales-b',
  fullName: 'Omar Sales',
  teamId: 'team-b',
}

const baseUnit: LeadraUnit = {
  id: 105,
  unitCode: 'NC3BR',
  developerId: 'dev-1',
  developerName: 'Palm Hills',
  projectId: 'project-new-cairo',
  projectName: 'New Cairo Estates',
  destinationId: 'dest-new-cairo',
  destinationName: 'New Cairo',
  unitType: 'Apartment',
  floor: '3rd',
  bua: 165,
  roofGardenArea: null,
  gardenArea: null,
  terraceArea: null,
  viewId: 'view-garden',
  viewName: 'Garden',
  bedrooms: 3,
  bathrooms: 2,
  elevator: true,
  landArea: null,
  furnished: false,
  finish: 'Fully Finished',
  paymentMethod: 'installment',
  totalAmount: 5_000_000,
  downPayment: 1_000_000,
  remainingPayment: 4_000_000,
  commissionPercentage: 1.5,
  commissionAmount: 75_000,
  installmentType: 'quarterly',
  installmentYears: 5,
  installmentAmount: 200_000,
  deliveryExpectancy: { mode: 'month_year', month: 3, year: 2028 },
  originalOwnerName: 'Original Owner',
  countryCode: '+971',
  originalOwnerPhone: '50 123 4567',
  normalizedOwnerPhone: '+971501234567',
  salesNotes: 'Owner prefers quick closing.',
  status: 'available',
  archived: false,
  isSpecial: false,
  specialMarkedAt: null,
  specialMarkedBy: null,
  createdBy: 'sales-a',
  createdByName: 'Sara Sales',
  teamId: 'team-a',
  branchId: 'branch-cairo',
  createdAt: '2026-05-04T00:00:00.000Z',
  updatedAt: '2026-05-04T00:00:00.000Z',
  media: [],
  adminManagerNotes: [],
}

describe('Leadra domain rules', () => {
  it('normalizes global owner phones before storage and duplicate checks', () => {
    expect(normalizeOwnerPhone('+971 50 123 4567', '+971')).toBe('+971501234567')
    expect(normalizeOwnerPhone('00971501234567', '+971')).toBe('+971501234567')
    expect(normalizeOwnerPhone('(010) 1234-5678', '+20')).toBe('+201012345678')
    expect(normalizeOwnerPhone('971501234567', '+971')).toBe('+971501234567')
  })

  it('returns localized owner phone country metadata for the selector', () => {
    expect(getOwnerPhoneCountryMeta('+20', 'en')).toMatchObject({ code: '+20', label: 'Egypt +20', placeholder: '01012345678' })
    expect(getOwnerPhoneCountryMeta('+971', 'ar')).toMatchObject({ code: '+971', label: 'الإمارات +971', placeholder: '0501234567' })
    expect(getOwnerPhoneCountryOptions('en').some((option) => option.value === '+44')).toBe(true)
  })

  it('formats delivery expectancy years without thousands separators', () => {
    expect(formatDeliveryExpectancy({ ...baseUnit, deliveryExpectancy: { mode: 'year', year: 2029 } }, 'en')).toBe('2029')
  })

  it('parses comma formatted numbers', () => {
    expect(parseFormattedNumber('5,500,000')).toBe(5_500_000)
    expect(parseFormattedNumber('EGP 1,250,000.50')).toBe(1_250_000.5)
  })

  it('limits sales operational actions to their own units', () => {
    expect(canUseUnitOperationalActions(salesA, baseUnit)).toBe(true)
    expect(canUseUnitOperationalActions(salesB, baseUnit)).toBe(false)
  })

  it('calculates installment totals from down payment and schedule rows', () => {
    const schedule = createInitialPaymentSchedule({ ...baseUnit, installmentStartMonth: '2026-01-01', installmentEndMonth: '2026-04-01', installmentAmount: 250_000 })
    expect(calculateInstallmentTotalAmount({ ...baseUnit, downPayment: 1_000_000, paymentSchedule: schedule })).toBe(1_500_000)
  })

  it('extracts pasted unit details and builds special social copy', () => {
    const lookups = [
      { id: 'dest-new-cairo', kind: 'destination' as const, label: 'New Cairo', archived: false },
      { id: 'project-new-cairo', kind: 'project' as const, label: 'New Cairo Estates', archived: false },
      { id: 'dev-1', kind: 'developer' as const, label: 'Palm Hills', archived: false },
      { id: 'view-garden', kind: 'view' as const, label: 'Garden', archived: false },
      { id: 'finish-1', kind: 'finish' as const, label: 'Fully Finished', archived: false },
    ]
    const parsed = parseSmartUnitDetails('Palm Hills New Cairo Estates New Cairo Garden Fully Finished price 5,500,000 BUA 165 bedrooms 3 owner phone 01012345678', lookups)
    expect(parsed.patch).toMatchObject({ projectId: 'project-new-cairo', totalAmount: 5_500_000, bua: 165, bedrooms: 3 })
    expect(buildSpecialUnitSocialCopy({ ...baseUnit, isSpecial: true }, 'en')).toContain('New Cairo Estates Apartment')
  })

  it('validates and formats owner phones against the selected country', () => {
    expect(validateOwnerPhoneForCountry('+971 50 123 4567', '+971')).toMatchObject({
      ok: true,
      localPhone: '0501234567',
    })
    expect(validateOwnerPhoneForCountry('1012345678', '+20')).toMatchObject({
      ok: true,
      localPhone: '01012345678',
    })
    expect(validateOwnerPhoneForCountry('12345', '+20')).toMatchObject({
      ok: false,
      countryLabel: 'Egypt +20',
      example: '01012345678',
    })
  })

  it('blocks duplicate normalized owner phone only inside the same project', () => {
    expect(unitHasSameProjectPhoneDuplicate({ ...baseUnit, id: 106 }, [baseUnit])).toBe(true)
    expect(
      unitHasSameProjectPhoneDuplicate(
        { ...baseUnit, projectId: 'project-zed' },
        [{ ...baseUnit, projectId: 'project-new-cairo' }],
      ),
    ).toBe(false)
  })

  it('applies owner visibility and owner-phone search permissions by role', () => {
    const managerOwnUnit = { ...baseUnit, createdBy: manager.id }

    expect(canViewOwnerData(admin, baseUnit)).toBe(true)
    expect(canViewOwnerData(subAdmin, baseUnit)).toBe(true)
    expect(canViewOwnerData(manager, baseUnit)).toBe(false)
    expect(canViewOwnerData(manager, managerOwnUnit)).toBe(true)
    expect(canViewOwnerData(salesA, baseUnit)).toBe(true)
    expect(canViewOwnerData(salesB, baseUnit)).toBe(false)

    expect(canSearchOwnerPhone(admin, baseUnit)).toBe(true)
    expect(canSearchOwnerPhone(subAdmin, baseUnit)).toBe(true)
    expect(canSearchOwnerPhone(manager, baseUnit)).toBe(false)
    expect(canSearchOwnerPhone(salesA, baseUnit)).toBe(false)
    expect(canSearchOwnerPhone(salesB, baseUnit)).toBe(false)

    expect(canViewSalesSensitiveData(admin, baseUnit)).toBe(true)
    expect(canViewSalesSensitiveData(subAdmin, baseUnit)).toBe(true)
    expect(canViewSalesSensitiveData(manager, baseUnit)).toBe(false)
    expect(canViewSalesSensitiveData(manager, managerOwnUnit)).toBe(true)
    expect(canViewSalesSensitiveData(salesA, baseUnit)).toBe(true)
    expect(canViewSalesSensitiveData(salesB, baseUnit)).toBe(false)
  })

  it('applies PRD edit permissions by role and own-upload scope', () => {
    const managerOwnUnit = { ...baseUnit, createdBy: manager.id, teamId: manager.teamId }
    const sameTeamOtherSalesUnit = { ...baseUnit, createdBy: salesB.id, teamId: manager.teamId }
    const otherTeamUnit = { ...baseUnit, createdBy: salesB.id, teamId: 'team-b' }

    expect(canEditNonOwnerUnitDetails(admin, otherTeamUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(subAdmin, otherTeamUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(manager, managerOwnUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(manager, sameTeamOtherSalesUnit)).toBe(false)
    expect(canEditNonOwnerUnitDetails(manager, otherTeamUnit)).toBe(false)
    expect(canEditNonOwnerUnitDetails(salesA, baseUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(salesB, baseUnit)).toBe(false)

    expect(canEditOwnerFields(admin, baseUnit)).toBe(true)
    expect(canEditOwnerFields(subAdmin, baseUnit)).toBe(true)
    expect(canEditOwnerFields(manager, managerOwnUnit)).toBe(true)
    expect(canEditOwnerFields(manager, sameTeamOtherSalesUnit)).toBe(false)
    expect(canEditOwnerFields(salesA, baseUnit)).toBe(true)
    expect(canEditOwnerFields(salesB, baseUnit)).toBe(false)

    expect(canEditUnitPricing(admin, baseUnit)).toBe(true)
    expect(canEditUnitPricing(subAdmin, baseUnit)).toBe(true)
    expect(canEditUnitPricing(manager, managerOwnUnit)).toBe(true)
    expect(canEditUnitPricing(manager, baseUnit)).toBe(false)
    expect(canEditUnitPricing(salesA, baseUnit)).toBe(true)
    expect(canEditUnitPricing(salesB, baseUnit)).toBe(false)

    expect(canEditUnitCommission(admin, baseUnit)).toBe(true)
    expect(canEditUnitCommission(subAdmin, baseUnit)).toBe(true)
    expect(canEditUnitCommission(manager, baseUnit)).toBe(false)
    expect(canEditUnitCommission(salesA, baseUnit)).toBe(false)

    expect(canEditAnyUnitDetails(manager, managerOwnUnit)).toBe(true)
    expect(canEditAnyUnitDetails(manager, sameTeamOtherSalesUnit)).toBe(false)
    expect(canEditAnyUnitDetails(salesB, baseUnit)).toBe(false)
  })

  it('lets admins and sub-admins edit all archived unit details', () => {
    const archivedUnit = { ...baseUnit, archived: true, createdBy: salesB.id, teamId: 'team-b' }

    expect(canEditNonOwnerUnitDetails(admin, archivedUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(subAdmin, archivedUnit)).toBe(true)
    expect(canEditUnitPricing(admin, archivedUnit)).toBe(true)
    expect(canEditUnitPricing(subAdmin, archivedUnit)).toBe(true)
    expect(canEditNonOwnerUnitDetails(manager, archivedUnit)).toBe(false)
    expect(canEditUnitPricing(salesB, archivedUnit)).toBe(false)
  })

  it('allows every role to view all units while keeping owner data separately restricted', () => {
    const sameBranchOtherTeam = { ...baseUnit, id: 106, teamId: 'team-b', branchId: 'branch-cairo', createdBy: salesB.id }
    const sameTeamOtherBranch = { ...baseUnit, id: 107, teamId: 'team-a', branchId: 'branch-alex' }
    const archivedOtherTeam = { ...baseUnit, id: 108, teamId: 'team-b', archived: true }

    expect(canViewUnit(admin, sameBranchOtherTeam)).toBe(true)
    expect(canViewUnit(manager, sameBranchOtherTeam)).toBe(true)
    expect(canViewUnit(salesA, sameBranchOtherTeam)).toBe(true)
    expect(canViewUnit(salesA, archivedOtherTeam)).toBe(true)
    expect(filterUnitsForUser(manager, [sameBranchOtherTeam, sameTeamOtherBranch, archivedOtherTeam])).toEqual([
      sameBranchOtherTeam,
      sameTeamOtherBranch,
      archivedOtherTeam,
    ])
    expect(canViewOwnerData(manager, sameBranchOtherTeam)).toBe(false)
    expect(canViewOwnerData(salesA, sameBranchOtherTeam)).toBe(false)
  })

  it('calculates cash, installment, custom installment, and commission values', () => {
    expect(calculatePaymentSummary({ paymentMethod: 'cash', totalAmount: 2_000_000 })).toMatchObject({
      remainingPayment: null,
      commissionAmount: 30_000,
      installmentAmount: null,
    })

    expect(
      calculatePaymentSummary({
        paymentMethod: 'installment',
        totalAmount: 5_000_000,
        downPayment: 1_000_000,
        installmentType: 'semi_annual',
        installmentStartMonth: '2026-03-01',
        installmentEndMonth: '2027-09-01',
      }),
    ).toMatchObject({
      remainingPayment: 4_000_000,
      commissionAmount: 75_000,
      installmentAmount: 1_000_000,
    })

    expect(
      calculatePaymentSummary({
        paymentMethod: 'installment',
        totalAmount: 5_000_000,
        downPayment: 1_000_000,
        installmentType: 'monthly',
        installmentStartMonth: '2026-01-01',
        installmentEndMonth: '2026-12-01',
      }).installmentAmount,
    ).toBe(333_333.33)

    expect(
      calculatePaymentSummary({
        paymentMethod: 'installment',
        totalAmount: 5_000_000,
        downPayment: 1_000_000,
        installmentType: 'custom',
        installmentYears: 4,
      }).installmentAmount,
    ).toBeNull()
  })

  it('builds equal installment schedules for automatic frequencies only', () => {
    const quarterlySchedule = buildInstallmentSchedule(baseUnit)

    expect(quarterlySchedule).toHaveLength(20)
    expect(quarterlySchedule[0]).toMatchObject({ paymentNumber: 1, yearNumber: 1, dueMonth: null, periodLabel: 'Q1', amount: 200_000 })
    expect(getInstallmentScheduledDueMonths('quarterly', '2026-03-01', '2026-12-01')).toEqual([
      '2026-03-01',
      '2026-06-01',
      '2026-09-01',
      '2026-12-01',
    ])
    expect(getInstallmentScheduledDueMonths('monthly', '2026-01-01', '2026-03-01')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
    expect(
      buildInstallmentSchedule({
        ...baseUnit,
        installmentYears: null,
        installmentStartMonth: '2026-03-01',
        installmentEndMonth: '2026-12-01',
        installmentAmount: 1_000_000,
      }).map((row) => row.dueMonth),
    ).toEqual(['2026-03-01', '2026-06-01', '2026-09-01', '2026-12-01'])
    expect(buildInstallmentSchedule({ ...baseUnit, installmentType: 'custom', installmentAmount: null })).toEqual([])
  })

  it('marks persisted timetable rows paid and recalculates remaining value from unpaid rows', () => {
    const schedule = createInitialPaymentSchedule({
      ...baseUnit,
      installmentYears: null,
      installmentStartMonth: '2026-03-01',
      installmentEndMonth: '2026-12-01',
      installmentAmount: 1_000_000,
      remainingPayment: 4_000_000,
    })
    const unit = {
      ...baseUnit,
      installmentYears: null,
      installmentStartMonth: '2026-03-01',
      installmentEndMonth: '2026-12-01',
      installmentAmount: 1_000_000,
      remainingPayment: 4_000_000,
      paymentSchedule: schedule,
      paymentHistory: [],
    }

    const paid = applyPaymentScheduleAction(unit, admin, schedule[0].id, true, '2026-05-15T10:00:00.000Z')
    expect(paid?.unit.remainingPayment).toBe(3_000_000)
    expect(paid?.history).toMatchObject({
      action: 'paid',
      amount: 1_000_000,
      previousRemainingValue: 4_000_000,
      newRemainingValue: 3_000_000,
      actorName: admin.fullName,
    })
    expect(buildPaymentTimetable(paid!.unit)[0]).toMatchObject({ paid: true, paidByName: admin.fullName })

    const unpaid = applyPaymentScheduleAction(paid!.unit, admin, schedule[0].id, false, '2026-05-15T11:00:00.000Z')
    expect(unpaid?.unit.remainingPayment).toBe(4_000_000)
    expect(unpaid?.unit.paymentHistory).toHaveLength(2)
    expect(unpaid?.history.action).toBe('unpaid')
  })

  it('calculates displayed paid and remaining totals with maintenance allocation', () => {
    const schedule = createInitialPaymentSchedule({
      ...baseUnit,
      installmentYears: null,
      installmentStartMonth: '2026-03-01',
      installmentEndMonth: '2026-12-01',
      installmentAmount: 1_000_000,
      remainingPayment: 4_000_000,
    })
    const unit = {
      ...baseUnit,
      downPayment: 1_000_000,
      installmentYears: null,
      installmentStartMonth: '2026-03-01',
      installmentEndMonth: '2026-12-01',
      installmentAmount: 1_000_000,
      maintenanceCost: 250_000,
      maintenancePaid: false,
      paymentSchedule: [{ ...schedule[0], paid: true }, ...schedule.slice(1)],
    }

    expect(calculateDisplayedPaymentTotals(unit)).toMatchObject({
      displayedPaidAmount: 2_000_000,
      displayedRemainingAmount: 3_250_000,
      unpaidMaintenanceAmount: 250_000,
    })
    expect(calculateDisplayedPaymentTotals({ ...unit, maintenancePaid: true })).toMatchObject({
      displayedPaidAmount: 2_000_000,
      displayedRemainingAmount: 3_000_000,
      paidMaintenanceAmount: 0,
    })
  })

  it('summarizes destinations before projects and scopes projects by destination', () => {
    const secondDestinationUnit = {
      ...baseUnit,
      id: 106,
      destinationId: 'dest-north-coast',
      destinationName: 'North Coast',
      projectId: 'project-marassi',
      projectName: 'Marassi',
      status: 'sold' as const,
    }

    const destinations = summarizeDestinations([baseUnit, secondDestinationUnit])
    const newCairoProjects = summarizeProjects([baseUnit, secondDestinationUnit], 'en', 'dest-new-cairo')

    expect(destinations.map((destination) => destination.destinationName)).toEqual(['New Cairo', 'North Coast'])
    expect(destinations[0]).toMatchObject({ totalUnits: 1, availableUnits: 1 })
    expect(newCairoProjects).toHaveLength(1)
    expect(newCairoProjects[0]).toMatchObject({ projectId: 'project-new-cairo', destinationId: 'dest-new-cairo' })
  })

  it('applies advanced search filters including zero bounds and protected owner phone', () => {
    const otherSalesUnit = {
      ...baseUnit,
      id: 106,
      unitCode: 'NC106BR2Ba1',
      createdBy: 'sales-b',
      teamId: 'team-b',
      originalOwnerPhone: '01099999999',
      normalizedOwnerPhone: '+201099999999',
      bedrooms: 2,
      bathrooms: 1,
      bua: 90,
      downPayment: 0,
      remainingPayment: 5_000_000,
      installmentAmount: 625_000,
    }

    expect(searchUnits(admin, [baseUnit, otherSalesUnit], { buaFrom: 0, buaTo: 100 })).toEqual([otherSalesUnit])
    expect(searchUnits(admin, [{ ...baseUnit, unitType: 'Town House', landArea: 260 }, otherSalesUnit], { unitType: 'Town House', landAreaFrom: 200, landAreaTo: 300 })).toEqual([{ ...baseUnit, unitType: 'Town House', landArea: 260 }])
    expect(searchUnits(admin, [{ ...baseUnit, floor: 'Ground', gardenArea: 55 }, otherSalesUnit], { unitType: 'Apartment', floor: 'Ground', gardenAreaFrom: 50, gardenAreaTo: 60 })).toEqual([{ ...baseUnit, floor: 'Ground', gardenArea: 55 }])
    expect(searchUnits(admin, [{ ...baseUnit, unitType: 'Penthouse', terraceArea: 40 }, otherSalesUnit], { unitType: 'Penthouse', terraceAreaFrom: 35, terraceAreaTo: 45 })).toEqual([{ ...baseUnit, unitType: 'Penthouse', terraceArea: 40 }])
    expect(searchUnits(admin, [{ ...baseUnit, id: 301, floor: 'Ground' }, { ...baseUnit, id: 302, floor: '2nd' }], { unitType: 'Apartment', floor: 'Ground' }).map((unit) => unit.id)).toEqual([301])
    expect(searchUnits(admin, [baseUnit, otherSalesUnit], { paymentMethod: 'installment', installmentType: 'quarterly', installmentAmountFrom: 150_000, installmentAmountTo: 250_000 })).toEqual([baseUnit])
    expect(searchUnits(admin, [
      { ...baseUnit, id: 201, deliveryExpectancy: { mode: 'year', year: 2027 } },
      { ...baseUnit, id: 202, deliveryExpectancy: { mode: 'year', year: 2028 } },
      { ...baseUnit, id: 203, deliveryExpectancy: { mode: 'year', year: 2029 } },
    ], { deliveryYearTo: 2028 }).map((unit) => unit.id)).toEqual([201, 202])
    expect(searchUnits(admin, [
      { ...baseUnit, id: 204, deliveryExpectancy: { mode: 'year', year: 2026 } },
      { ...baseUnit, id: 205, deliveryExpectancy: { mode: 'year', year: 2027 } },
      { ...baseUnit, id: 206, deliveryExpectancy: { mode: 'year', year: 2028 } },
      { ...baseUnit, id: 207, deliveryExpectancy: { mode: 'year', year: 2029 } },
    ], { deliveryYearFrom: 2027, deliveryYearTo: 2028 }).map((unit) => unit.id)).toEqual([205, 206])
    expect(searchUnits(admin, [
      { ...baseUnit, id: 208, deliveryExpectancy: { mode: 'year', year: 2027 } },
      { ...baseUnit, id: 209, deliveryExpectancy: { mode: 'year', year: 2028 } },
      { ...baseUnit, id: 210, deliveryExpectancy: { mode: 'year', year: 2029 } },
    ], { deliveryYearFrom: 2028 }).map((unit) => unit.id)).toEqual([209, 210])
    expect(searchUnits(salesA, [baseUnit, otherSalesUnit], { ownerPhone: '01099999999' })).toEqual([])
    expect(searchUnits(salesA, [baseUnit, otherSalesUnit], { ownerPhone: '501234567' })).toEqual([])
    expect(searchUnits(subAdmin, [baseUnit, otherSalesUnit], { ownerPhone: '501234567' })).toEqual([baseUnit])
  })

  it('normalizes reactive filters before counting or searching', () => {
    expect(normalizeReactiveUnitFilters({
      paymentMethod: 'cash',
      installmentType: 'quarterly',
      installmentAmountFrom: 100_000,
      cashPriceFrom: 1_000_000,
    })).toEqual({
      paymentMethod: 'cash',
      cashPriceFrom: 1_000_000,
    })
    expect(normalizeReactiveUnitFilters({
      unitType: 'Apartment',
      floor: '2nd',
      gardenAreaFrom: 20,
    })).toEqual({
      unitType: 'Apartment',
      floor: '2nd',
    })
    expect(countActiveUnitFilters({
      paymentMethod: 'cash',
      installmentAmountFrom: 100_000,
    })).toBe(1)
  })

  it('keeps advanced search usable on a pre-filtered special unit set', () => {
    const specialUnit = { ...baseUnit, isSpecial: true }
    const otherSpecialUnit = { ...baseUnit, id: 106, unitCode: 'ZE4BR', isSpecial: true, bedrooms: 4 }
    const regularUnit = { ...baseUnit, id: 107, unitCode: 'RG2BR', isSpecial: false, bedrooms: 2 }
    const specialUnits = [specialUnit, otherSpecialUnit, regularUnit].filter((unit) => unit.isSpecial)

    expect(searchUnits(admin, specialUnits, { bedrooms: 4 })).toEqual([otherSpecialUnit])
    expect(searchUnits(admin, specialUnits, { unitCode: 'RG' })).toEqual([])
  })

  it('defines the fixed PRD unit types and conditional fields', () => {
    expect(PRD_UNIT_TYPES).toEqual([
      'One Story Villa',
      'Stand Alone',
      'Twin House',
      'Town House',
      'Apartment',
      'Chalet',
      'Duplex',
      'Senior Chalet',
      'Junior Chalet',
      'Loft',
      'Cabin',
      'Penthouse',
    ])

    for (const unitType of ['One Story Villa', 'Stand Alone', 'Twin House', 'Town House']) {
      expect(getApplicableUnitAreaFields(unitType)).toMatchObject({ showFloor: false, showLandArea: true, showGardenArea: false, showTerraceArea: false })
    }
    for (const unitType of ['Apartment', 'Chalet', 'Duplex', 'Senior Chalet', 'Junior Chalet', 'Loft']) {
      expect(getApplicableUnitAreaFields(unitType, '2nd')).toMatchObject({ showFloor: true, showLandArea: false, showGardenArea: false, showTerraceArea: false })
      expect(getApplicableUnitAreaFields(unitType, 'Ground')).toMatchObject({ showFloor: true, showLandArea: false, showGardenArea: true, showTerraceArea: false })
    }
    expect(getApplicableUnitAreaFields('Cabin')).toMatchObject({ showFloor: false, showLandArea: false, showGardenArea: false, showTerraceArea: false })
    expect(getApplicableUnitAreaFields('Penthouse')).toMatchObject({ showFloor: false, showLandArea: false, showGardenArea: false, showTerraceArea: true })
  })

  it('supports Ground, floors 1 through 40, and Last Floor for floor-based unit types', () => {
    expect(PRD_FLOOR_OPTIONS[0]).toBe('Ground')
    expect(PRD_FLOOR_OPTIONS[1]).toBe('Last Floor')
    expect(PRD_FLOOR_OPTIONS).toHaveLength(42)
    expect(PRD_FLOOR_OPTIONS).toContain('40th')
    expect(PRD_FLOOR_OPTIONS.at(-1)).toBe('40th')
    expect(PRD_FLOOR_OPTIONS).not.toContain('Roof')
  })

  it('generates the PRD unit code from project abbreviation and bedroom count', () => {
    expect(deriveProjectAbbreviation('Mountain View')).toBe('MV')
    expect(deriveProjectAbbreviation('ZED')).toBe('ZE')
    expect(generateUnitCode('Mountain View', 3)).toBe('MV3BR')
    expect(generateUnitCode('Mountain View', 3)).toBe(generateUnitCode('Mountain View', 3))
    expect(generateUnitCode('New Cairo', 3)).not.toContain('Ba')
  })

  it('validates media limits and chooses the first image thumbnail', () => {
    const files: LeadraMediaFile[] = [
      { id: 'i1', type: 'image', url: '/living.jpg', name: 'living.jpg', sizeBytes: 1_000_000 },
    ]

    expect(validateMediaUpload(files)).toEqual({ ok: true })
    expect(getThumbnailMedia(files)?.id).toBe('i1')
    expect(
      validateMediaUpload([
        { id: 'v1', type: 'video', url: '/tour.mp4', name: 'tour.mp4', sizeBytes: 1_000_000 },
      ] as unknown as LeadraMediaFile[]),
    ).toMatchObject({
      ok: false,
      message: 'Upload failed. Videos are not allowed in unit media.',
      messageKey: 'error.invalidVideoUpload',
    })
    expect(
      validateMediaUpload([{ id: 'big', type: 'image', url: '/big.jpg', name: 'big.jpg', sizeBytes: 41 * 1024 * 1024 }]),
    ).toMatchObject({
      ok: false,
      message:
        'Upload failed. Total media size exceeds 40 MB per unit. Please remove or compress some files.',
    })
    expect(
      validateMediaUpload(
        Array.from({ length: 11 }, (_, index) => ({
          id: `image-${index}`,
          type: 'image' as const,
          url: `/image-${index}.jpg`,
          name: `image-${index}.jpg`,
          sizeBytes: 1000,
        })),
      ),
    ).toMatchObject({
      ok: false,
      message: 'Upload failed. A unit can include up to 10 media files.',
    })
  })

  it('archives only for allowed roles and sanitizes restricted PDF output', () => {
    expect(canArchiveUnit(admin, baseUnit)).toBe(true)
    expect(canArchiveUnit(subAdmin, baseUnit)).toBe(true)
    expect(canArchiveUnit(manager, baseUnit)).toBe(false)
    expect(canArchiveUnit(salesA, baseUnit)).toBe(false)
    expect(canManageUnitSpecialStatus(admin, baseUnit)).toBe(true)
    expect(canManageUnitSpecialStatus(subAdmin, baseUnit)).toBe(true)
    expect(canManageUnitSpecialStatus(manager, baseUnit)).toBe(false)
    expect(canManageUnitSpecialStatus(salesA, baseUnit)).toBe(false)
    expect(canManageUnitSpecialStatus(admin, { ...baseUnit, archived: true })).toBe(false)

    const sanitized = sanitizeUnitForPdf(salesB, baseUnit)
    expect(sanitized.originalOwnerName).toBeNull()
    expect(sanitized.originalOwnerPhone).toBeNull()
    expect(sanitized.normalizedOwnerPhone).toBeNull()
  })
})
