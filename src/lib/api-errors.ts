const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'Invoice not found': 'Invoice not found',
  'Unauthorized': 'Unauthorized',
  'No file provided': 'No file provided',
  'File must be PDF, PNG, or JPG': 'File must be PDF, PNG, or JPG',
  'File must be smaller than 10MB': 'File must be smaller than 10MB',
}

export function toSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return SAFE_ERROR_MESSAGES[message] ?? 'An unexpected error occurred'
}
