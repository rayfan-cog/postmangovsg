import moment from 'moment'

export enum ChannelType {
  SMS = 'SMS',
  Email = 'EMAIL',
  Telegram = 'TELEGRAM',
  Govsg = 'GOVSG',
}

export enum Status {
  Draft = 'Draft',
  Scheduled = 'Scheduled',
  Sending = 'Sending',
  Sent = 'Sent',
  Halted = 'Halted',
}

export enum StatusFilter {
  Draft = 'Draft',
  Sent = 'Sent',
  Scheduled = 'Scheduled',
}

export enum SortField {
  Created = 'created_at',
  Sent = 'sent_at',
}

export enum Ordering {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const channelIcons = {
  [ChannelType.SMS]: 'bx-message-detail',
  [ChannelType.Email]: 'bx-envelope-open',
  [ChannelType.Telegram]: 'bx-paper-plane',
  [ChannelType.Govsg]: 'bxl-whatsapp',
}

export interface CampaignJobApiResponse {
  status: string
  sent_at?: string
  status_updated_at?: string
  visible_at?: string
}

// Fields are optional because constructors are also called with partial
// payloads (e.g. `new Campaign({})` defaults, the create-campaign response).
export interface CampaignApiResponse {
  id?: number
  name?: string
  type?: string
  created_at?: string | Date
  halted?: boolean
  job_queue?: CampaignJobApiResponse[]
  is_csv_processing?: boolean
  protect?: boolean
  redacted?: boolean
  demo_message_limit?: number | null
  cost_per_message?: number
  // Not sent by the API: derived from job_queue by the service layer
  sentAt?: string
  statusUpdatedAt?: string
  visibleAt?: string
}

// Channel-specific payloads also carry these recipient/credential fields
export interface ChannelCampaignApiResponse extends CampaignApiResponse {
  csv_filename?: string | null
  num_recipients?: number | null
  has_credential?: boolean
}

export interface CampaignStatsApiResponse {
  error?: number | string
  unsent?: number | string
  sent?: number | string
  invalid?: number
  status?: Status
  delivered?: number
  read?: number
  status_updated_at?: string
  updated_at?: string
  halted?: boolean
  wait_time?: number
  unsubscribed?: number
  visible_at?: string
}

export interface CampaignRecipientApiResponse {
  recipient?: string
  status?: string
  error_code?: string | null
  updated_at?: string
}

export class Campaign {
  id: number
  name: string
  type: ChannelType
  createdAt: string
  sentAt?: string
  status: Status
  isCsvProcessing: boolean
  statusUpdatedAt?: string
  protect: boolean
  redacted: boolean
  demoMessageLimit: number | null
  costPerMessage?: number
  scheduledAt?: Date
  visibleAt?: string

  constructor(input: CampaignApiResponse) {
    this.id = input.id as number
    this.name = input.name as string
    this.type = input.type as ChannelType
    this.createdAt = input.created_at as string
    this.status = input.halted
      ? Status.Halted
      : this.getStatus(input.job_queue as CampaignJobApiResponse[])
    this.isCsvProcessing = input.is_csv_processing as boolean
    this.sentAt = input.sentAt
    this.statusUpdatedAt = input.statusUpdatedAt
    this.protect = input.protect as boolean
    this.redacted = input.redacted as boolean
    this.demoMessageLimit = input.demo_message_limit as number | null
    this.costPerMessage = input.cost_per_message
    this.visibleAt = input.visibleAt
    // override sentAt if it's a scheduled campaign
    if (this.visibleAt) {
      if (new Date(this.visibleAt) > new Date()) {
        // don't show sent at if it's scheduled but not sent out yet
        this.sentAt = undefined
      } else {
        this.sentAt = this.visibleAt
      }
    }
    if (this.status === Status.Scheduled) {
      const jobs = input.job_queue as CampaignJobApiResponse[]
      const jobsVisibleTime = jobs
        .map(({ visible_at: visibleAt }) => new Date(visibleAt as string))
        .sort()
      this.scheduledAt = jobsVisibleTime[0]
    }
  }

  getStatus(jobs: CampaignJobApiResponse[]): Status {
    if (jobs) {
      const jobSet = new Set(jobs.map((x) => x.status))
      // TODO: frontend and backend are misaligned in how they determine if a campaign has been sent (part 2/2)
      if (
        ['READY', 'ENQUEUED', 'SENDING', 'SENT', 'STOPPED'].some((s) =>
          jobSet.has(s)
        )
      ) {
        if (
          jobs.every(({ visible_at }) => {
            return visible_at && new Date(visible_at) >= new Date()
          })
        ) {
          return Status.Scheduled
        }
        return Status.Sending
      } else if (jobSet.has('LOGGED')) {
        return Status.Sent
      }
    }
    return Status.Draft
  }
}

export class CampaignStats {
  error: number
  unsent: number
  sent: number
  invalid: number
  read: number
  delivered: number
  status: Status
  statusUpdatedAt: string // Timestamp when job's status was changed to this status
  updatedAt: string // Timestamp when statistic was updated
  halted?: boolean
  waitTime?: number
  redacted?: boolean
  unsubscribed?: number
  visibleAt?: string

  constructor(input: CampaignStatsApiResponse) {
    this.error = +(input.error as number | string)
    this.unsent = +(input.unsent as number | string)
    this.sent = +(input.sent as number | string)
    this.invalid = input.invalid as number
    this.status = input.status as Status
    this.delivered = input.delivered || 0
    this.read = input.read || 0
    this.statusUpdatedAt = input.status_updated_at as string
    this.updatedAt = input.updated_at as string
    this.halted = input.halted
    this.waitTime = input.wait_time
    this.unsubscribed = input.unsubscribed
    this.visibleAt = input.visible_at
  }
}

export abstract class CampaignRecipient {
  recipient: string
  status: string
  errorCode: string
  updatedAt: string

  constructor(input: CampaignRecipientApiResponse) {
    this.recipient = input.recipient as string
    this.status = input.status as string
    this.errorCode = this.formatErrorCode(input.error_code as string)
    this.updatedAt = moment(input.updated_at).format('LLL').replace(',', '')
  }

  protected abstract formatErrorCode(errorCode: string): string
}
