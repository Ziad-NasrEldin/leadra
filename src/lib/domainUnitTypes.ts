export const PRD_UNIT_TYPES = [
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
] as const

export type PrdUnitType = (typeof PRD_UNIT_TYPES)[number]
export type PrdUnitAreaMode = 'land' | 'floor' | 'bua_only' | 'terrace'

export interface PrdUnitTypeSpec {
  unitType: PrdUnitType
  areaMode: PrdUnitAreaMode
}

export const PRD_UNIT_TYPE_SPECS: PrdUnitTypeSpec[] = PRD_UNIT_TYPES.map((unitType) => ({
  unitType,
  areaMode:
    unitType === 'Cabin'
      ? 'bua_only'
      : unitType === 'Penthouse'
        ? 'terrace'
        : ['One Story Villa', 'Stand Alone', 'Twin House', 'Town House'].includes(unitType)
          ? 'land'
          : 'floor',
}))
export const PRD_FLOOR_OPTIONS = ['Ground', 'Last Floor', ...Array.from({ length: 40 }, (_, index) => formatOrdinalFloorLabel(index + 1))] as const

export function getPrdUnitTypeSpec(unitType: string): PrdUnitTypeSpec {
  return PRD_UNIT_TYPE_SPECS.find((spec) => spec.unitType === unitType) ?? PRD_UNIT_TYPE_SPECS.find((spec) => spec.unitType === 'Apartment')!
}

export function isPrdUnitType(unitType: string): unitType is PrdUnitType {
  return PRD_UNIT_TYPES.includes(unitType as PrdUnitType)
}

export function getApplicableUnitAreaFields(unitType: string, floor = '') {
  const spec = getPrdUnitTypeSpec(unitType)
  return {
    showFloor: spec.areaMode === 'floor',
    showLandArea: spec.areaMode === 'land',
    showGardenArea: spec.areaMode === 'floor' && floor === 'Ground',
    showTerraceArea: spec.areaMode === 'terrace',
  }
}

function formatOrdinalFloorLabel(floor: number): string {
  const remainder = floor % 100
  if (remainder >= 11 && remainder <= 13) return `${floor}th`
  switch (floor % 10) {
    case 1:
      return `${floor}st`
    case 2:
      return `${floor}nd`
    case 3:
      return `${floor}rd`
    default:
      return `${floor}th`
  }
}
