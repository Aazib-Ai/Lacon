/**
 * Log redaction utilities for Phase 2
 * Ensures sensitive data never appears in logs or crash reports
 */

const REDACTED = '[REDACTED]'

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /\b(sk-[a-zA-Z0-9]{6,})\b/gi, // OpenAI style (relaxed minimum length)
  /\b(Bearer\s+[a-zA-Z0-9\-._~+/]+=*)\b/gi, // Bearer tokens

  // Common key formats
  /api[_-]?key["\s:=]+([a-zA-Z0-9\-._~+/]+)/gi,
  /secret["\s:=]+([a-zA-Z0-9\-._~+/]+)/gi,
  /token["\s:=]+([a-zA-Z0-9\-._~+/]+)/gi,
  /password["\s:=]+([a-zA-Z0-9\-._~+/]+)/gi,

  // Email addresses (PII)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Phone numbers
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

  // Generic long alphanumeric (potential keys) - must be last
  /\b([a-zA-Z0-9]{32,})\b/g,
]

// Fields that should always be redacted in objects
const SENSITIVE_FIELD_NAMES = new Set([
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'secretKey',
  'secret_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'password',
  'passwd',
  'pwd',
  'privateKey',
  'private_key',
  'encryptedValue',
  'encrypted_value',
])

/**
 * Redact sensitive data from a string
 */
export function redactString(input: string): string {
  let result = input

  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTED)
  }

  return result
}

/**
 * Redact sensitive fields from an object
 */
export function redactObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return redactString(obj)
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item))
  }

  const redacted: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      redacted[key] = REDACTED
    } else if (typeof value === 'object') {
      redacted[key] = redactObject(value)
    } else if (typeof value === 'string') {
      redacted[key] = redactString(value)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Safe console.log replacement that redacts sensitive data
 */
export function safeLog(level: 'log' | 'info' | 'warn' | 'error', ...args: any[]): void {
  const redactedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      return redactString(arg)
    }
    if (typeof arg === 'object') {
      return redactObject(arg)
    }
    return arg
  })

  // eslint-disable-next-line no-console
  console[level](...redactedArgs)
}

/**
 * Create a safe logger instance
 */
export function createSafeLogger(prefix: string) {
  return {
    log: (...args: any[]) => safeLog('log', `[${prefix}]`, ...args),
    info: (...args: any[]) => safeLog('info', `[${prefix}]`, ...args),
    warn: (...args: any[]) => safeLog('warn', `[${prefix}]`, ...args),
    error: (...args: any[]) => safeLog('error', `[${prefix}]`, ...args),
  }
}

/**
 * Redact sensitive data from error objects for crash reporting
 */
export function redactError(error: Error): any {
  return {
    name: error.name,
    message: redactString(error.message),
    stack: error.stack ? redactString(error.stack) : undefined,
  }
}
