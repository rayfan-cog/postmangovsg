import { Update } from 'telegraf/typings/telegram-types'

import { TelegramCallbackService } from '@telegram/services'

const mockLoggerInfo = jest.fn()
jest.mock('@core/logger', () => ({
  loggerWithLabel: () => ({
    info: (logMeta: unknown) => mockLoggerInfo(logMeta),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  }),
}))

const { Telegraf, Telegram } = jest.requireActual('telegraf')

const BOT_ID = '12345'
const BOT_TOKEN = `${BOT_ID}:fake-bot-token`

describe('TelegramCallbackService.handleUpdate', () => {
  beforeEach(() => {
    jest.spyOn(Telegraf.prototype, 'handleUpdate').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockLoggerInfo.mockReset()
  })

  test('logs the bot id but not the bot token when the token is verified', async () => {
    jest.spyOn(Telegram.prototype, 'getMe').mockResolvedValue({} as any)

    await TelegramCallbackService.handleUpdate(BOT_ID, BOT_TOKEN, {} as Update)

    expect(mockLoggerInfo).toHaveBeenCalledWith({
      message: 'Bot token verified',
      botId: BOT_ID,
      action: 'verifyBotToken',
    })
    expect(JSON.stringify(mockLoggerInfo.mock.calls)).not.toContain(BOT_TOKEN)
  })

  test('throws when the bot token is invalid', async () => {
    jest.spyOn(Telegram.prototype, 'getMe').mockRejectedValue(new Error())

    await expect(
      TelegramCallbackService.handleUpdate(BOT_ID, BOT_TOKEN, {} as Update)
    ).rejects.toThrow('Bot token invalid.')
    expect(mockLoggerInfo).not.toHaveBeenCalled()
  })
})
