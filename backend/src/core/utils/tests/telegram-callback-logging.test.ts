import { redactTelegramCallbackUrl } from '../telegram-callback-logging'

test('redacts the bot token from Telegram callback route variants', () => {
  expect(redactTelegramCallbackUrl('/v1/callback/telegram/12345:abc-DEF')).toBe(
    '/v1/callback/telegram/[REDACTED]'
  )
  expect(
    redactTelegramCallbackUrl('/V1/CALLBACK/TELEGRAM/12345%3Aabc/?foo=bar')
  ).toBe('/V1/CALLBACK/TELEGRAM/[REDACTED]/?foo=bar')
})

test('leaves other URLs unchanged', () => {
  expect(redactTelegramCallbackUrl('/v1/callback/telegram')).toBe(
    '/v1/callback/telegram'
  )
  expect(redactTelegramCallbackUrl('/v1/campaign/1/telegram/12345:abc')).toBe(
    '/v1/campaign/1/telegram/12345:abc'
  )
})
