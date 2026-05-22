interface FunctionErrorBody {
  error?: string
  message?: string
}

export async function throwFunctionError(error: unknown, fallback: string): Promise<never> {
  const baseMessage = error instanceof Error ? error.message : fallback
  const context = typeof error === 'object' && error && 'context' in error
    ? (error as { context?: unknown }).context
    : null

  if (context instanceof Response) {
    const response = context.clone()
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const body = await response.json() as FunctionErrorBody
        const message = body.error ?? body.message
        if (message) throw new Error(message)
      } catch (parseError) {
        if (parseError instanceof Error && parseError.name === 'Error') throw parseError
      }
    } else {
      const text = await response.text().catch(() => '')
      if (text.trim()) throw new Error(text.trim())
    }
  }

  throw new Error(baseMessage)
}
