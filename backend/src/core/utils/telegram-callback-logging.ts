const TELEGRAM_CALLBACK_BOT_TOKEN = /^(\/v1\/callback\/telegram\/)[^/?#]+/i

/** Replace the bot token path segment of a Telegram webhook URL. */
export const redactTelegramCallbackUrl = (url: string): string =>
  url.replace(TELEGRAM_CALLBACK_BOT_TOKEN, '$1[REDACTED]')
