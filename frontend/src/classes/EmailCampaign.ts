import { i18n } from '@lingui/core'
import { t } from '@lingui/macro'
import { get } from 'lodash'

import {
  Campaign,
  CampaignRecipient,
  CampaignRecipientApiResponse,
  ChannelCampaignApiResponse,
} from './Campaign'

const emailErrors = {
  'Hard bounce': t`errors.email.hardBounce`,
  'Soft bounce': t`errors.email.softBounce`,
  'Recipient is incorrectly formatted': t`errors.email.invalidFormat`,
  abuse: t`errors.email.complaint`,
}

export enum EmailProgress {
  CreateTemplate,
  UploadRecipients,
  SendTestMessage,
  Send,
}

export interface EmailPreview {
  body: string
  themedBody: string
  subject: string
  replyTo: string | null
  from: string
}

export interface EmailCampaignApiResponse extends ChannelCampaignApiResponse {
  email_templates?: {
    body?: string
    params?: Array<string>
    subject?: string
    reply_to?: string | null
    from?: string
    show_logo?: boolean
    themed_body?: string
  }
  user?: {
    domain?: {
      agency?: {
        name?: string
        logo_uri?: string
      }
    }
  }
  should_bcc_to_me?: boolean
}

// Keys are flattened by the export endpoint's Sequelize `raw: true` query
export interface EmailCampaignRecipientApiResponse
  extends CampaignRecipientApiResponse {
  'unsubscriber.recipient'?: string
  'unsubscriber.reason'?: string | null
}

export class EmailCampaign extends Campaign {
  body: string
  params: Array<string>
  subject: string
  replyTo: string | null
  from: string
  showLogo: boolean
  csvFilename: string
  numRecipients: number
  hasCredential: boolean
  agencyName: string
  agencyLogoURI: string
  themedBody: string
  progress: EmailProgress = EmailProgress.CreateTemplate
  shouldBccToMe: boolean

  constructor(input: EmailCampaignApiResponse) {
    super(input)
    this.body = input.email_templates?.body as string
    this.params = input.email_templates?.params as Array<string>
    this.subject = input.email_templates?.subject as string
    this.replyTo = input.email_templates?.reply_to as string | null
    this.from = input.email_templates?.from as string
    this.showLogo = input.email_templates?.show_logo as boolean
    this.themedBody = input.email_templates?.themed_body as string
    this.csvFilename = input.csv_filename as string
    this.numRecipients = input.num_recipients as number
    this.hasCredential = input.has_credential as boolean
    this.agencyName = input.user?.domain?.agency?.name as string
    this.agencyLogoURI = input.user?.domain?.agency?.logo_uri as string
    this.setProgress()
    this.shouldBccToMe = input.should_bcc_to_me || false
  }

  setProgress() {
    if (!this.body || !this.subject) {
      this.progress = EmailProgress.CreateTemplate
    } else if (!this.numRecipients) {
      this.progress = EmailProgress.UploadRecipients
    } else if (!this.hasCredential) {
      this.progress = EmailProgress.SendTestMessage
    } else {
      this.progress = EmailProgress.Send
    }
  }
}

export class EmailCampaignRecipient extends CampaignRecipient {
  unsubscriber: string
  unsubscribeReason: string

  constructor(input: EmailCampaignRecipientApiResponse) {
    super(input)
    this.unsubscriber = input['unsubscriber.recipient'] as string
    this.unsubscribeReason = input['unsubscriber.reason'] || ''
  }

  formatErrorCode(errorCode: string): string {
    const blacklistMsg = t`errors.email.blacklist`
    let formatted = ''
    switch (this.status) {
      case 'SENDING':
      case 'SUCCESS':
      case 'READ':
        return ''
      case 'INVALID_RECIPIENT':
        // If error code is null and status is invalid, the email has been blacklisted. Otherwise, the error has not been mapped.
        formatted =
          errorCode !== null
            ? get(emailErrors, errorCode, errorCode)
            : blacklistMsg
        return i18n._(formatted)
    }

    return errorCode
  }
}
