import { describe, expect, it } from 'vitest'
import { throwFunctionError } from './functionErrors'

function functionErrorWithResponse(response: Response): Error & { context: Response } {
  return Object.assign(new Error('Function request failed.'), { context: response })
}

describe('throwFunctionError', () => {
  it('prefers JSON error messages from edge function responses', async () => {
    const error = functionErrorWithResponse(new Response(
      JSON.stringify({ error: 'Password is too weak.' }),
      { headers: { 'content-type': 'application/json' } },
    ))

    await expect(throwFunctionError(error, 'Fallback failed.')).rejects.toThrow('Password is too weak.')
  })

  it('uses text response bodies when the edge function response is not JSON', async () => {
    const error = functionErrorWithResponse(new Response('Sales representative has open assignments.'))

    await expect(throwFunctionError(error, 'Fallback failed.')).rejects.toThrow('Sales representative has open assignments.')
  })

  it('falls back to the original error message when response details are unavailable', async () => {
    await expect(throwFunctionError(new Error('Function request failed.'), 'Fallback failed.')).rejects.toThrow('Function request failed.')
  })
})
