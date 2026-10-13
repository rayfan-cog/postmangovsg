export const REDACTED = '[REDACTED]'

// Credentials, one-time codes, and recipient PII that must never reach request logs.
const SENSITIVE_BODY_KEYS = new Set([
  'otp',
  'password',
  'password_hash',
  'twilio_account_sid',
  'twilio_api_key',
  'twilio_api_secret',
  'twilio_messaging_service_sid',
  'telegram_bot_token',
  'api_key',
  'api_secret',
  'email',
  'recipient',
  'recipients',
  'cc',
  'bcc',
  'notification_contacts',
])

const SENSITIVE_BODY_KEY_PATTERN = /(secret|token|password|api_?key)/i

export const isSensitiveBodyKey = (key: string): boolean =>
  SENSITIVE_BODY_KEYS.has(key.toLowerCase()) ||
  SENSITIVE_BODY_KEY_PATTERN.test(key)

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Returns a copy of a request body with sensitive keys redacted at any depth.
 * The input is never mutated, so route handlers keep seeing the original body.
 */
export const redactSensitiveBodyFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveBodyFields)
  }
  if (!isPlainObject(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      isSensitiveBodyKey(key) ? REDACTED : redactSensitiveBodyFields(field),
    ])
  )
}
