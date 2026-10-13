import { InitAuthService } from '@core/services/auth.service'
import { MailService } from '@core/services/mail.service'
import { RedisService } from '@core/services/redis.service'

const mockLoggerError = jest.fn()
jest.mock('@core/logger', () => ({
  loggerWithLabel: () => ({
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}))

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe('sendOtp', () => {
  const email = 'user@agency.gov.sg'
  const redisService = {
    otpClient: {
      set: jest.fn((...args: unknown[]) => {
        const callback = args[args.length - 1] as (error: null) => void
        callback(null)
      }),
    },
  } as unknown as RedisService

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  test('saves the hashed otp and sends the otp email', async () => {
    const sendMail = jest
      .spyOn(MailService.mailClient, 'sendMail')
      .mockResolvedValue('250 Ok')

    await InitAuthService(redisService).sendOtp(email, '127.0.0.1')
    await flushPromises()

    expect(redisService.otpClient.set).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: [email] })
    )
    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  test('logs instead of rejecting when the otp email fails to send', async () => {
    const error = new Error('SMTP failure')
    jest.spyOn(MailService.mailClient, 'sendMail').mockRejectedValue(error)

    await expect(
      InitAuthService(redisService).sendOtp(email, '127.0.0.1')
    ).resolves.toBeUndefined()
    await flushPromises()

    expect(redisService.otpClient.set).toHaveBeenCalledTimes(1)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to send OTP email',
        email,
        error,
        action: 'sendOtp',
      })
    )
  })
})
