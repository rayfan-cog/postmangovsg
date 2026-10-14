import {
  isSensitiveBodyKey,
  redactSensitiveBodyFields,
  REDACTED,
} from '../request-logging'

test('flags credential, OTP, and recipient keys case-insensitively', () => {
  ;[
    'otp',
    'OTP',
    'password_hash',
    'twilio_api_secret',
    'twilio_api_key',
    'twilio_account_sid',
    'twilio_messaging_service_sid',
    'telegram_bot_token',
    'email',
    'recipient',
    'cc',
    'bcc',
    'notification_contacts',
    'clientSecret',
    'access_token',
    'apiKey',
  ].forEach((key) => expect(isSensitiveBodyKey(key)).toBe(true))
  ;['label', 'subject', 'from', 'reply_to', 'classification', 'tag'].forEach(
    (key) => expect(isSensitiveBodyKey(key)).toBe(false)
  )
})

test('redacts sensitive SMS credential fields and keeps the rest', () => {
  expect(
    redactSensitiveBodyFields({
      label: 'my-creds',
      twilio_account_sid: 'sid',
      twilio_api_key: 'key',
      twilio_api_secret: 'secret',
      twilio_messaging_service_sid: 'msid',
      recipient: '+6591234567',
    })
  ).toEqual({
    label: 'my-creds',
    twilio_account_sid: REDACTED,
    twilio_api_key: REDACTED,
    twilio_api_secret: REDACTED,
    twilio_messaging_service_sid: REDACTED,
    recipient: REDACTED,
  })
})

test('redacts login OTP and email', () => {
  expect(
    redactSensitiveBodyFields({ email: 'user@agency.gov.sg', otp: 'ABCD1234' })
  ).toEqual({ email: REDACTED, otp: REDACTED })
})

test('redacts nested fields without mutating the original body', () => {
  const body = {
    subject: 'hi',
    cc: ['a@b.com'],
    attachments: [{ name: 'file.pdf', data: REDACTED }],
    nested: [{ telegram_bot_token: 'token', label: 'bot' }],
  }
  const snapshot = JSON.parse(JSON.stringify(body))

  expect(redactSensitiveBodyFields(body)).toEqual({
    subject: 'hi',
    cc: REDACTED,
    attachments: [{ name: 'file.pdf', data: REDACTED }],
    nested: [{ telegram_bot_token: REDACTED, label: 'bot' }],
  })
  expect(body).toEqual(snapshot)
})

test('passes through non-object bodies and null-prototype objects', () => {
  expect(redactSensitiveBodyFields(undefined)).toBeUndefined()
  expect(redactSensitiveBodyFields('raw')).toBe('raw')
  const body = Object.assign(Object.create(null), { otp: '1', label: 'x' })
  expect(redactSensitiveBodyFields(body)).toEqual({ otp: REDACTED, label: 'x' })
})
