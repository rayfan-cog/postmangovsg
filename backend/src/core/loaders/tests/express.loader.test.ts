import express from 'express'
import request from 'supertest'
import winston from 'winston'
import { Writable } from 'stream'
import { addTransport } from '@core/logger'
import { createRequestLogger } from '@core/loaders/express.loader'

const logLines: string[] = []
addTransport(
  new winston.transports.Stream({
    stream: new Writable({
      write(chunk, _encoding, callback): void {
        logLines.push(chunk.toString())
        callback()
      },
    }),
  })
)

const handledBodies: unknown[] = []
const bodiesAfterResponse: unknown[] = []
const app = express()
app.use(express.json())
app.use(createRequestLogger())
app.post('/v1/*', (req, res) => {
  handledBodies.push(JSON.parse(JSON.stringify(req.body)))
  res.on('finish', () =>
    bodiesAfterResponse.push(JSON.parse(JSON.stringify(req.body)))
  )
  res.json(req.body)
})

const findRequestLog = async (
  url: string
): Promise<{ line: string; req: any }> => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const line = logLines.find((l) =>
      l.includes(`Incoming HTTP Request POST ${url}`)
    )
    if (line) {
      const entry = JSON.parse(line)
      return { line, req: (entry.metadata ?? entry).req }
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`No request log found for ${url}`)
}

beforeEach(() => {
  logLines.length = 0
  handledBodies.length = 0
  bodiesAfterResponse.length = 0
})

test('redacts login OTP and email from the request log', async () => {
  const body = { email: 'user@agency.gov.sg', otp: 'PAB89E6S' }
  const res = await request(app).post('/v1/auth/login').send(body)

  expect(res.status).toBe(200)
  expect(res.body).toEqual(body)
  expect(handledBodies).toEqual([body])

  const { line, req } = await findRequestLog('/v1/auth/login')
  expect(req.body).toEqual({ email: '[REDACTED]', otp: '[REDACTED]' })
  expect(line).not.toContain('PAB89E6S')
  expect(line).not.toContain('user@agency.gov.sg')
})

test('redacts Twilio credentials but keeps non-sensitive fields', async () => {
  const body = {
    label: 'my-twilio',
    twilio_account_sid: 'FAKE_ACCOUNT_SID',
    twilio_api_key: 'FAKE_API_KEY',
    twilio_api_secret: 'FAKE_TWILIO_SECRET_123',
    twilio_messaging_service_sid: 'FAKE_MSG_SID',
    recipient: '+6591234567',
  }
  const res = await request(app)
    .post('/v1/settings/sms/credentials')
    .set('Authorization', 'Bearer FAKE_API_KEY_HEADER')
    .send(body)

  expect(res.body).toEqual(body)

  const { line, req } = await findRequestLog('/v1/settings/sms/credentials')
  expect(req.method).toBe('POST')
  expect(req.headers.authorization).toBe('[REDACTED]')
  expect(req.body).toEqual({
    label: 'my-twilio',
    twilio_account_sid: '[REDACTED]',
    twilio_api_key: '[REDACTED]',
    twilio_api_secret: '[REDACTED]',
    twilio_messaging_service_sid: '[REDACTED]',
    recipient: '[REDACTED]',
  })
  ;[
    'FAKE_ACCOUNT_SID',
    'FAKE_API_KEY',
    'FAKE_TWILIO_SECRET_123',
    'FAKE_MSG_SID',
    '+6591234567',
  ].forEach((value) => expect(line).not.toContain(value))
})

test('redacts Telegram bot token and email body content', async () => {
  const body = {
    telegram_bot_token: 'FAKE_BOT_TOKEN',
    subject: 'Hello',
    body: 'secret email content',
  }
  await request(app).post('/v1/campaign/1/telegram/new-credentials').send(body)

  const { line, req } = await findRequestLog(
    '/v1/campaign/1/telegram/new-credentials'
  )
  expect(req.body).toEqual({
    telegram_bot_token: '[REDACTED]',
    subject: 'Hello',
    body: '[REDACTED]',
  })
  expect(line).not.toContain('FAKE_BOT_TOKEN')
  expect(line).not.toContain('secret email content')
})

test('redacts email body and attachment data without mutating req.body', async () => {
  const body = {
    subject: 'Hello',
    body: 'secret email content',
    attachments: [{ filename: 'a.txt', data: 'FAKE_ATTACHMENT_DATA' }],
  }
  await request(app).post('/v1/transactional/email/send').send(body)

  const { line, req } = await findRequestLog('/v1/transactional/email/send')
  expect(req.body).toEqual({
    subject: 'Hello',
    body: '[REDACTED]',
    attachments: [{ filename: 'a.txt', data: '[REDACTED]' }],
  })
  expect(line).not.toContain('secret email content')
  expect(line).not.toContain('FAKE_ATTACHMENT_DATA')
  expect(bodiesAfterResponse).toEqual([body])
})
