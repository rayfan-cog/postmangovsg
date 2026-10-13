import { t } from '@lingui/macro'

import {
  Campaign,
  CampaignRecipient,
  ChannelCampaignApiResponse,
} from './Campaign'

export enum SMSProgress {
  CreateTemplate,
  UploadRecipients,
  InsertCredentials,
  Send,
}

export interface SMSPreview {
  body: string
}

export interface SMSCampaignApiResponse extends ChannelCampaignApiResponse {
  sms_templates?: {
    body?: string
    params?: Array<string>
  }
}

export class SMSCampaign extends Campaign {
  body: string
  params: Array<string>
  csvFilename: string
  numRecipients: number
  hasCredential: boolean
  progress: SMSProgress = SMSProgress.CreateTemplate

  constructor(input: SMSCampaignApiResponse) {
    super(input)
    this.body = input.sms_templates?.body as string
    this.params = input.sms_templates?.params as Array<string>
    this.csvFilename = input.csv_filename as string
    this.numRecipients = input.num_recipients as number
    this.hasCredential = input.has_credential as boolean
    this.setProgress()
  }

  setProgress() {
    if (!this.body) {
      this.progress = SMSProgress.CreateTemplate
    } else if (!this.numRecipients) {
      this.progress = SMSProgress.UploadRecipients
    } else if (!this.hasCredential) {
      this.progress = SMSProgress.InsertCredentials
    } else {
      this.progress = SMSProgress.Send
    }
  }
}

export class SMSCampaignRecipient extends CampaignRecipient {
  formatErrorCode(errorCode: string): string {
    if (errorCode) {
      if (errorCode.startsWith("The 'To'")) {
        return t`errors.sms.invalidPhoneNumber`
      } else if (errorCode === 'Recipient is incorrectly formatted') {
        return t`errors.sms.invalidFormat`
      }
    }
    return errorCode || ''
  }
}
