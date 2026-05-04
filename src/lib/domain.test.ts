import { describe, expect, it } from 'vitest'
import {
  calculatePaymentSummary,
  canArchiveUnit,
  canSearchOwnerPhone,
  canViewOwnerData,
  filterUnitsForUser,
  generateUnitCode,
  getThumbnailMedia,
  inferOwnerPhoneCountryCode,
  normalizeOwnerPhone,
  sanitizeUnitForPdf,
  unitHasSameProjectPhoneDuplicate,
  validateMediaUpload,
} from './domain'
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
  unitCode: 'NE105BR3Ba2',
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

  it('infers country code from the combined owner phone field', () => {
    expect(inferOwnerPhoneCountryCode('+971 50 123 4567')).toBe('+971')
    expect(inferOwnerPhoneCountryCode('00966501234567')).toBe('+966')
    expect(inferOwnerPhoneCountryCode('01012345678')).toBe('+20')
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
    expect(canViewOwnerData(admin, baseUnit)).toBe(true)
    expect(canViewOwnerData(manager, baseUnit)).toBe(true)
    expect(canViewOwnerData(salesA, baseUnit)).toBe(true)
    expect(canViewOwnerData(salesB, baseUnit)).toBe(false)

    expect(canSearchOwnerPhone(admin, baseUnit)).toBe(true)
    expect(canSearchOwnerPhone(manager, baseUnit)).toBe(true)
    expect(canSearchOwnerPhone(salesA, baseUnit)).toBe(true)
    expect(canSearchOwnerPhone(salesB, baseUnit)).toBe(false)
  })

  it('limits manager visibility to team units and does not use branches for visibility', () => {
    const sameBranchOtherTeam = { ...baseUnit, id: 106, teamId: 'team-b', branchId: 'branch-cairo' }
    const sameTeamOtherBranch = { ...baseUnit, id: 107, teamId: 'team-a', branchId: 'branch-alex' }

    expect(filterUnitsForUser(manager, [sameBranchOtherTeam, sameTeamOtherBranch])).toEqual([
      sameTeamOtherBranch,
    ])
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
        installmentYears: 4,
      }),
    ).toMatchObject({
      remainingPayment: 4_000_000,
      commissionAmount: 75_000,
      installmentAmount: 500_000,
    })

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

  it('generates the PRD unit code format from destination, id, bedrooms, and bathrooms', () => {
    expect(generateUnitCode('New Cairo', 105, 3, 2)).toBe('NE105BR3Ba2')
    expect(generateUnitCode('North Edge', 7, 1, 1)).toBe('NO7BR1Ba1')
  })

  it('validates media limits and chooses the first image thumbnail', () => {
    const files: LeadraMediaFile[] = [
      { id: 'v1', type: 'video', url: '/tour.mp4', name: 'tour.mp4', sizeBytes: 5_000_000 },
      { id: 'i1', type: 'image', url: '/living.jpg', name: 'living.jpg', sizeBytes: 1_000_000 },
    ]

    expect(validateMediaUpload(files)).toEqual({ ok: true })
    expect(getThumbnailMedia(files)?.id).toBe('i1')
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
    expect(canArchiveUnit(manager, baseUnit)).toBe(true)
    expect(canArchiveUnit(salesA, baseUnit)).toBe(false)

    const sanitized = sanitizeUnitForPdf(salesB, baseUnit)
    expect(sanitized.originalOwnerName).toBeNull()
    expect(sanitized.originalOwnerPhone).toBeNull()
    expect(sanitized.normalizedOwnerPhone).toBeNull()
  })
})
