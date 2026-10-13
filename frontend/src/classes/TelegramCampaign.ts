import { t } from '@lingui/macro'

import {
  Campaign,
  CampaignRecipient,
  ChannelCampaignApiResponse,
} from './Campaign'

export enum TelegramProgress {
  CreateTemplate,
  UploadRecipients,
  InsertCredentials,
  Send,
}

export interface TelegramPreview {
  body: string
}

export interface TelegramCampaignApiResponse
  extends ChannelCampaignApiResponse {
  telegram_templates?: {
    body?: string
    params?: Array<string>
  }
  preview?: string
}

export class TelegramCampaign extends Campaign {
  body: string
  params: Array<string>
  csvFilename: string
  numRecipients: number
  preview: string
  hasCredential: boolean
  progress: TelegramProgress = TelegramProgress.CreateTemplate

  constructor(input: TelegramCampaignApiResponse) {
    super(input)
    this.body = input.telegram_templates?.body as string
    this.params = input.telegram_templates?.params as Array<string>
    this.csvFilename = input.csv_filename as string
    this.numRecipients = input.num_recipients as number
    this.preview = input.preview as string
    this.hasCredential = input.has_credential as boolean
    this.setProgress()
  }

  setProgress() {
    if (!this.body) {
      this.progress = TelegramProgress.CreateTemplate
    } else if (!this.numRecipients) {
      this.progress = TelegramProgress.UploadRecipients
    } else if (!this.hasCredential) {
      this.progress = TelegramProgress.InsertCredentials
    } else {
      this.progress = TelegramProgress.Send
    }
  }
}

export class TelegramCampaignRecipient extends CampaignRecipient {
  formatErrorCode(errorCode: string): string {
    if (errorCode) {
      // Telegram errors has the following format: [code]: [error message]
      const code = +errorCode.split(':')[0]
      switch (code) {
        case 1:
        case 2:
          return t`errors.telegram.notSubscribed`
        case 403:
          return t`errors.telegram.blocked`
      }
    }

    return errorCode || ''
  }
}
