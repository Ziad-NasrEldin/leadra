import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrandedSelect } from './LeadraUi'

describe('BrandedSelect', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('expands desktop menus to fit long option labels', async () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function getScrollWidth(this: HTMLElement) {
      return this.classList.contains('brand-select-menu') ? 360 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains('brand-select-trigger')) {
        return {
          x: 100,
          y: 80,
          top: 80,
          right: 260,
          bottom: 132,
          left: 100,
          width: 160,
          height: 52,
          toJSON: () => ({}),
        }
      }

      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }
    })

    render(
      <>
        <span id="developer-select-label">Developer</span>
        <BrandedSelect
          labelId="developer-select-label"
          options={[
            { value: 'sodic', label: 'SODIC' },
            { value: 'qa-long', label: 'QA_LIVE_Developer_With_Long_Name' },
          ]}
        />
      </>,
    )

    await userEvent.click(screen.getByRole('combobox', { name: /developer/i }))

    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: /developer/i })).toHaveStyle({ width: '360px' })
    })
  })

  it('keeps the portaled menu anchored to the trigger after opening', async () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(160)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains('brand-select-trigger')) {
        return {
          x: 100,
          y: 80,
          top: 80,
          right: 260,
          bottom: 132,
          left: 100,
          width: 160,
          height: 52,
          toJSON: () => ({}),
        }
      }

      if (this.classList.contains('brand-select')) {
        return {
          x: 100,
          y: 80,
          top: 80,
          right: 260,
          bottom: 200,
          left: 100,
          width: 160,
          height: 120,
          toJSON: () => ({}),
        }
      }

      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }
    })

    render(
      <>
        <span id="destination-select-label">Destination</span>
        <BrandedSelect
          labelId="destination-select-label"
          options={[
            { value: 'new-cairo', label: 'New Cairo' },
            { value: 'sheikh-zayed', label: 'Sheikh Zayed' },
          ]}
        />
      </>,
    )

    await userEvent.click(screen.getByRole('combobox', { name: /destination/i }))

    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: /destination/i })).toHaveStyle({ top: '140px' })
    })
  })
})
