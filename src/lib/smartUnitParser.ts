import { parseFormattedNumber } from './numberFormat'
import type { InstallmentType, LookupValue, PaymentMethod } from './types'

export type SmartUnitField =
  | 'destinationId'
  | 'developerId'
  | 'projectId'
  | 'unitType'
  | 'bua'
  | 'landArea'
  | 'gardenArea'
  | 'terraceArea'
  | 'floor'
  | 'viewId'
  | 'bedrooms'
  | 'bathrooms'
  | 'finish'
  | 'paymentMethod'
  | 'totalAmount'
  | 'downPayment'
  | 'installmentType'
  | 'installmentStartMonth'
  | 'installmentEndMonth'
  | 'ownerName'
  | 'ownerPhone'
  | 'salesNotes'

export type SmartUnitPatch = Partial<Record<SmartUnitField, string | number | PaymentMethod | InstallmentType>>

export function parseSmartUnitDetails(text: string, lookupValues: LookupValue[]): { patch: SmartUnitPatch; matched: string[] } {
  const patch: SmartUnitPatch = {}
  const matched: string[] = []
  const source = text.trim()
  const lower = source.toLowerCase()

  matchLookup('destination', 'destinationId')
  matchLookup('developer', 'developerId')
  matchLookup('project', 'projectId')
  matchLookup('view', 'viewId')
  matchLookup('finish', 'finish', true)

  setText('unitType', /\b(?:type|unit type)\s*[:-]\s*([^\n,]+)/i)
  setText('floor', /\bfloor\s*[:-]\s*([^\n,]+)/i)
  setNumber('bua', /\b(?:bua|area)\s*[:-]?\s*([\d,.]+)/i)
  setNumber('landArea', /\b(?:land area|land)\s*[:-]?\s*([\d,.]+)/i)
  setNumber('gardenArea', /\b(?:garden area|garden)\s*[:-]?\s*([\d,.]+)/i)
  setNumber('terraceArea', /\b(?:terrace area|terrace)\s*[:-]?\s*([\d,.]+)/i)
  setNumber('bedrooms', /\b(?:bedrooms|beds|br)\s*[:-]?\s*(\d+)/i)
  setNumber('bathrooms', /\b(?:bathrooms|baths)\s*[:-]?\s*(\d+)/i)
  setNumber('totalAmount', /\b(?:total|price|amount|cash price)\s*[:-]?\s*([\d,.]+)/i)
  setNumber('downPayment', /\b(?:down payment|down)\s*[:-]?\s*([\d,.]+)/i)
  setText('ownerName', /\bowner(?: name)?\s*[:-]\s*([^\n,]+)/i)
  setText('ownerPhone', /\b(?:owner phone|phone|mobile)\s*[:-]?\s*(\+?[\d\s() -]{8,})/i)

  if (/\binstall/i.test(lower)) {
    patch.paymentMethod = 'installment'
    matched.push('payment method')
  } else if (/\bcash\b/i.test(lower)) {
    patch.paymentMethod = 'cash'
    matched.push('payment method')
  }

  const installmentType = lower.match(/\b(monthly|quarterly|semi[-\s]?annual|annual|custom)\b/)
  if (installmentType) {
    patch.installmentType = installmentType[1].replace(/\s|-/, '_') as InstallmentType
    matched.push('installment type')
  }

  const months = [...source.matchAll(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/g)].map((match) => `${match[1]}-${match[2].padStart(2, '0')}`)
  if (months[0]) {
    patch.installmentStartMonth = months[0]
    matched.push('start month')
  }
  if (months[1]) {
    patch.installmentEndMonth = months[1]
    matched.push('end month')
  }

  if (!patch.salesNotes && source) patch.salesNotes = source
  return { patch, matched }

  function setText(field: SmartUnitField, pattern: RegExp) {
    const match = source.match(pattern)
    if (!match?.[1]) return
    patch[field] = match[1].trim()
    matched.push(field)
  }

  function setNumber(field: SmartUnitField, pattern: RegExp) {
    const match = source.match(pattern)
    if (!match?.[1]) return
    patch[field] = parseFormattedNumber(match[1])
    matched.push(field)
  }

  function matchLookup(kind: LookupValue['kind'], field: SmartUnitField, useLabel = false) {
    const values = lookupValues.filter((item) => item.kind === kind && !item.archived)
    const found = values.find((item) => lower.includes(item.label.toLowerCase()))
    if (!found) return
    patch[field] = useLabel ? found.label : found.id
    matched.push(kind)
  }
}
